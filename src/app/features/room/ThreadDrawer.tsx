import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Box, Header, Icon, IconButton, Scroll, Text, Avatar, config, Icons } from 'folds';
import { Room, MatrixEvent, RoomEvent } from 'matrix-js-sdk';
import classNames from 'classnames';

import * as css from './ThreadDrawer.css';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useSetting, useSetSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { useRoomEvent } from '../../hooks/useRoomEvent';
import { RenderMessageContent } from '../../components/RenderMessageContent';
import { MessageBase } from '../../components/message';
import { getMemberDisplayName, getMemberAvatarMxc } from '../../utils/room';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { UserAvatar } from '../../components/user-avatar';
import { ThreadInput } from './ThreadInput';

type ThreadDrawerProps = {
  room: Room;
};

function ThreadDrawerHeader() {
  const setThreadDrawer = useSetSetting(settingsAtom, 'isThreadOpen');

  return (
    <Header className={css.ThreadDrawerHeader} variant="Background" size="600">
      <Box grow="Yes" alignItems="Center" gap="200">
        <Box grow="Yes" alignItems="Center" gap="200">
          <Text size="H5" truncate>
            Thread
          </Text>
        </Box>
        <Box shrink="No" alignItems="Center">
          <IconButton variant="Background" onClick={() => setThreadDrawer(false)}>
            <Icon src={Icons.Cross} />
          </IconButton>
        </Box>
      </Box>
    </Header>
  );
}

export function ThreadDrawer({ room }: ThreadDrawerProps) {
  const mx = useMatrixClient();
  const [activeThreadId] = useSetting(settingsAtom, 'activeThreadId');
  const useAuthentication = useMediaAuthentication();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [drawerWidth, setDrawerWidth] = useState(480);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = drawerWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = startX - moveEvent.clientX;
        const newWidth = Math.max(320, Math.min(startWidth + delta, window.innerWidth * 0.5));
        setDrawerWidth(newWidth);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [drawerWidth],
  );

  const parentEvent = useRoomEvent(room, activeThreadId ?? '');

  const threadEvents = useMemo(() => {
    if (!activeThreadId) return [];

    const events: MatrixEvent[] = [];
    const timelineSet = room.getUnfilteredTimelineSet();
    const timelines = timelineSet.getTimelines();

    timelines.forEach((timeline: { getEvents: () => MatrixEvent[] }) => {
      timeline.getEvents().forEach((evt: MatrixEvent) => {
        const relations = evt.getRelation();
        if (
          relations &&
          relations.rel_type === 'm.thread' &&
          relations.event_id === activeThreadId
        ) {
          events.push(evt);
        }
      });
    });

    return events.sort((a, b) => a.getTs() - b.getTs());
  }, [room, activeThreadId, refreshKey]);

  // Listen for new timeline events to auto-refresh
  useEffect(() => {
    const handleTimelineEvent = () => {
      setRefreshKey((k) => k + 1);
    };

    room.on(RoomEvent.Timeline, handleTimelineEvent);
    return () => {
      room.removeListener(RoomEvent.Timeline, handleTimelineEvent);
    };
  }, [room]);

  if (!activeThreadId || !parentEvent) {
    return (
      <Box
        ref={containerRef}
        className={classNames(css.ThreadDrawerContainer)}
        shrink="No"
        direction="Column"
        style={{ width: drawerWidth }}
      >
        <ThreadDrawerHeader />
        <Box justifyContent="Center" alignItems="Center" style={{ padding: config.space.S400 }}>
          <Text>Select a thread to view</Text>
        </Box>
        <Box className={css.ResizeHandle} onMouseDown={handleMouseDown} />
      </Box>
    );
  }

  const senderId = parentEvent.getSender() ?? '';
  const senderDisplayName =
    getMemberDisplayName(room, senderId) ?? getMxIdLocalPart(senderId) ?? senderId;
  const senderAvatarMxc = getMemberAvatarMxc(room, senderId);

  return (
    <Box
      ref={containerRef}
      className={classNames(css.ThreadDrawerContainer)}
      shrink="No"
      direction="Column"
      style={{ width: drawerWidth }}
    >
      <ThreadDrawerHeader />
      <Box className={css.ThreadDrawerContent} grow="Yes">
        <Scroll ref={scrollRef} variant="Background" size="300" visibility="Hover" hideTrack>
          <Box direction="Column" gap="300" style={{ padding: config.space.S300 }}>
            <Box direction="Column" gap="100">
              <Box alignItems="Center" gap="100">
                <Avatar size="300">
                  <UserAvatar
                    userId={senderId}
                    src={
                      senderAvatarMxc
                        ? mxcUrlToHttp(mx, senderAvatarMxc, useAuthentication, 48, 48, 'crop') ??
                          undefined
                        : undefined
                    }
                    alt={senderDisplayName}
                    renderFallback={() => <Icon size="200" src={Icons.User} filled />}
                  />
                </Avatar>
                <Box direction="Column" gap="0">
                  <Text size="T400" truncate>
                    <b>{senderDisplayName}</b>
                  </Text>
                  <Text size="T200" priority="300">
                    {new Date(parentEvent.getTs()).toLocaleTimeString()}
                  </Text>
                </Box>
              </Box>
              <MessageBase>
                <RenderMessageContent
                  displayName={senderDisplayName}
                  msgType={parentEvent.getContent().msgtype ?? ''}
                  ts={parentEvent.getTs()}
                  edited={false}
                  getContent={() => parentEvent.getContent()}
                  mediaAutoLoad
                  urlPreview
                  htmlReactParserOptions={{
                    replace: (domNode) => false,
                  }}
                  linkifyOpts={{
                    ignoreTags: [],
                  }}
                  outlineAttachment={false}
                />
              </MessageBase>
            </Box>

            {threadEvents.length > 0 && (
              <>
                <Box alignItems="Center" gap="100">
                  <Box style={{ flex: 1, height: 1, background: 'var(--outline-variant)' }} />
                  <Text size="T200" priority="300">
                    {threadEvents.length} {threadEvents.length === 1 ? 'reply' : 'replies'}
                  </Text>
                  <Box style={{ flex: 1, height: 1, background: 'var(--outline-variant)' }} />
                </Box>
                {threadEvents.map((relEvent) => {
                  const replySenderId = relEvent.getSender() ?? '';
                  const replySenderDisplayName =
                    getMemberDisplayName(room, replySenderId) ??
                    getMxIdLocalPart(replySenderId) ??
                    replySenderId;
                  const replySenderAvatarMxc = getMemberAvatarMxc(room, replySenderId);

                  return (
                    <Box key={relEvent.getId()} direction="Column" gap="100">
                      <Box alignItems="Center" gap="100">
                        <Avatar size="200">
                          <UserAvatar
                            userId={replySenderId}
                            src={
                              replySenderAvatarMxc
                                ? mxcUrlToHttp(
                                    mx,
                                    replySenderAvatarMxc,
                                    useAuthentication,
                                    32,
                                    32,
                                    'crop'
                                  ) ?? undefined
                                : undefined
                            }
                            alt={replySenderDisplayName}
                            renderFallback={() => <Icon size="100" src={Icons.User} />}
                          />
                        </Avatar>
                        <Box direction="Column" gap="0">
                          <Text size="T300" truncate>
                            <b>{replySenderDisplayName}</b>
                          </Text>
                          <Text size="T200" priority="300">
                            {new Date(relEvent.getTs()).toLocaleTimeString()}
                          </Text>
                        </Box>
                      </Box>
                      <MessageBase space="100">
                        <RenderMessageContent
                          displayName={replySenderDisplayName}
                          msgType={relEvent.getContent().msgtype ?? ''}
                          ts={relEvent.getTs()}
                          edited={false}
                          getContent={() => relEvent.getContent()}
                          mediaAutoLoad
                          urlPreview
                          htmlReactParserOptions={{
                            replace: (domNode) => false,
                          }}
                          linkifyOpts={{
                            ignoreTags: [],
                          }}
                          outlineAttachment={false}
                        />
                      </MessageBase>
                    </Box>
                  );
                })}
              </>
            )}
          </Box>
        </Scroll>
      </Box>
      {!!activeThreadId && (
        <ThreadInput
          key={activeThreadId}
          room={room}
          activeThreadId={activeThreadId}
          onMessageSent={() => setRefreshKey((k) => k + 1)}
        />
      )}
      <Box className={css.ResizeHandle} onMouseDown={handleMouseDown} />
    </Box>
  );
}
