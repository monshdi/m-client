import React, { useCallback, useRef, useState } from 'react';
import { Icon, IconButton, Icons, Line, PopOut, Scroll } from 'folds';
import Room from 'matrix-js-sdk';
import { isKeyHotkey } from 'is-hotkey';
import { Transforms, Editor } from 'slate';
import { ReactEditor } from 'slate-react';
import { useAtom, useAtomValue } from 'jotai';

import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import {
  CustomEditor,
  useEditor,
  Toolbar,
  toPlainText,
  isEmptyEditor,
  createEmoticonElement,
  moveCursor,
  AUTOCOMPLETE_PREFIXES,
  AutocompletePrefix,
  AutocompleteQuery,
  getAutocompleteQuery,
  getPrevWorldRange,
  UserMentionAutocomplete,
  EmoticonAutocomplete,
} from '../../components/editor';
import { BlockType } from '../../components/editor/types';
import { EmojiBoard, EmojiBoardTab } from '../../components/emoji-board';
import { UseStateProvider } from '../../components/UseStateProvider';
import { mobileOrTablet } from '../../utils/user-agent';
import { useImagePackRooms } from '../../hooks/useImagePackRooms';
import { roomToParentsAtom } from '../../state/room/roomToParents';
import { useFilePicker } from '../../hooks/useFilePicker';
import { useFilePasteHandler } from '../../hooks/useFilePasteHandler';
import { useFileDropZone } from '../../hooks/useFileDrop';
import { TUploadContent, encryptFile } from '../../utils/matrix';
import { safeFile } from '../../utils/mimeTypes';
import { fulfilledPromiseSettledResult } from '../../utils/common';
import {
  getAudioMsgContent,
  getFileMsgContent,
  getImageMsgContent,
  getVideoMsgContent,
} from './msgContent';
import {
  TUploadItem,
  TUploadMetadata,
  threadIdToUploadItemsAtomFamily,
  roomUploadAtomFamily,
} from '../../state/room/roomInputDrafts';
import { UploadCardRenderer } from '../../components/upload-card';
import { UploadBoard, UploadBoardContent, UploadBoardHeader } from '../../components/upload-board';
import type { UploadBoardImperativeHandlers } from '../../components/upload-board';
import {
  Upload,
  UploadStatus,
  UploadSuccess,
  createUploadFamilyObserverAtom,
} from '../../state/upload';

type ThreadInputInnerProps = {
  room: Room;
  activeThreadId: string;
  onMessageSent?: () => void;
  editor: ReturnType<typeof useEditor>;
};

function ThreadInputInner({ room, activeThreadId, onMessageSent, editor }: ThreadInputInnerProps) {
  const mx = useMatrixClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const uploadBoardHandlers = useRef<UploadBoardImperativeHandlers>();

  const [toolbar, setToolbar] = useSetting(settingsAtom, 'editorToolbar');
  const roomToParents = useAtomValue(roomToParentsAtom);
  const imagePackRooms = useImagePackRooms(room.roomId, roomToParents);
  const [hideStickerBtn] = useState(document.body.clientWidth < 500);

  const [uploadBoard, setUploadBoard] = useState(true);
  const [selectedFiles, setSelectedFiles] = useAtom(
    threadIdToUploadItemsAtomFamily(`${room.roomId}:${activeThreadId}`),
  );
  const [autocompleteQuery, setAutocompleteQuery] =
    useState<AutocompleteQuery<AutocompletePrefix>>();

  const uploadFamilyObserverAtom = createUploadFamilyObserverAtom(
    roomUploadAtomFamily,
    selectedFiles.map((f) => f.file),
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      setUploadBoard(true);
      const safeFiles = files.map(safeFile);
      const fileItems: TUploadItem[] = [];

      if (room.hasEncryptionStateEvent()) {
        const encryptFiles = fulfilledPromiseSettledResult(
          await Promise.allSettled(safeFiles.map((f) => encryptFile(f))),
        );
        encryptFiles.forEach((ef) =>
          fileItems.push({
            ...ef,
            metadata: {
              markedAsSpoiler: false,
            },
          }),
        );
      } else {
        safeFiles.forEach((f) =>
          fileItems.push({
            file: f,
            originalFile: f,
            encInfo: undefined,
            metadata: {
              markedAsSpoiler: false,
            },
          }),
        );
      }
      setSelectedFiles({
        type: 'PUT',
        item: fileItems,
      });
    },
    [setSelectedFiles, room],
  );
  const pickFile = useFilePicker(handleFiles, true);
  const handlePaste = useFilePasteHandler(handleFiles);
  useFileDropZone(containerRef, handleFiles);

  const handleFileMetadata = useCallback(
    (fileItem: TUploadItem, metadata: TUploadMetadata) => {
      setSelectedFiles({
        type: 'REPLACE',
        item: fileItem,
        replacement: { ...fileItem, metadata },
      });
    },
    [setSelectedFiles],
  );

  const handleRemoveUpload = useCallback(
    (upload: TUploadContent | TUploadContent[]) => {
      const uploads = Array.isArray(upload) ? upload : [upload];
      setSelectedFiles({
        type: 'DELETE',
        item: selectedFiles.filter((f) => uploads.find((u) => u === f.file)),
      });
      uploads.forEach((u) => roomUploadAtomFamily.remove(u));
    },
    [setSelectedFiles, selectedFiles],
  );

  const handleCancelUpload = (uploads: Upload[]) => {
    uploads.forEach((upload) => {
      if (upload.status === UploadStatus.Loading) {
        mx.cancelUpload(upload.promise);
      }
    });
    handleRemoveUpload(uploads.map((upload) => upload.file));
  };

  const handleSendUpload = async (uploads: UploadSuccess[]) => {
    const contents = await Promise.all(
      uploads.map(async (upload) => {
        const fileItem = selectedFiles.find((f) => f.file === upload.file);
        if (!fileItem) return null;

        let content;
        if (fileItem.file.type.startsWith('image')) {
          content = await getImageMsgContent(mx, fileItem, upload.mxc);
        } else if (fileItem.file.type.startsWith('video')) {
          content = await getVideoMsgContent(mx, fileItem, upload.mxc);
        } else if (fileItem.file.type.startsWith('audio')) {
          content = getAudioMsgContent(fileItem, upload.mxc);
        } else {
          content = getFileMsgContent(fileItem, upload.mxc);
        }

        return {
          ...content,
          'm.relates_to': {
            rel_type: 'm.thread',
            event_id: activeThreadId,
            is_falling_back: false,
          },
        };
      }),
    );

    await Promise.all(
      contents.filter(Boolean).map((content) => mx.sendMessage(room.roomId, content!)),
    );

    handleCancelUpload(uploads);
    onMessageSent?.();
  };

  const handleSendReply = useCallback(async () => {
    uploadBoardHandlers.current?.handleSend();

    if (isEmptyEditor(editor) || !activeThreadId) return;

    const plainText = toPlainText(editor.children, false).trim();
    if (!plainText) return;

    const content = {
      msgtype: 'm.text',
      body: plainText,
      'm.relates_to': {
        rel_type: 'm.thread',
        event_id: activeThreadId,
        is_falling_back: false,
      },
    };

    try {
      mx.sendMessage(room.roomId, content);
      Transforms.delete(editor, {
        at: {
          anchor: Editor.start(editor, []),
          focus: Editor.end(editor, []),
        },
      });
      Transforms.setNodes(editor, { type: BlockType.Paragraph });
      onMessageSent?.();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }, [mx, room, editor, activeThreadId, onMessageSent]);

  const handleKeyDown = useCallback(
    (evt: React.KeyboardEvent) => {
      if (isKeyHotkey('enter', evt) && !evt.shiftKey) {
        evt.preventDefault();
        handleSendReply();
      }
    },
    [handleSendReply],
  );

  const handleEmoticonSelect = (key: string, shortcode: string) => {
    editor.insertNode(createEmoticonElement(key, shortcode));
    moveCursor(editor);
  };

  const handleKeyUp = useCallback(
    (evt: React.KeyboardEvent) => {
      if (isKeyHotkey('escape', evt)) {
        evt.preventDefault();
        return;
      }

      const prevWordRange = getPrevWorldRange(editor);
      const query = prevWordRange
        ? getAutocompleteQuery<AutocompletePrefix>(editor, prevWordRange, AUTOCOMPLETE_PREFIXES)
        : undefined;
      setAutocompleteQuery(query);
    },
    [editor],
  );

  const handleCloseAutocomplete = useCallback(() => {
    setAutocompleteQuery(undefined);
    ReactEditor.focus(editor);
  }, [editor]);

  return (
    <div ref={containerRef}>
      {selectedFiles.length > 0 && (
        <UploadBoard
          header={
            <UploadBoardHeader
              open={uploadBoard}
              onToggle={() => setUploadBoard(!uploadBoard)}
              uploadFamilyObserverAtom={uploadFamilyObserverAtom}
              onSend={handleSendUpload}
              imperativeHandlerRef={uploadBoardHandlers}
              onCancel={handleCancelUpload}
            />
          }
        >
          {uploadBoard && (
            <Scroll size="300" hideTrack visibility="Hover">
              <UploadBoardContent>
                {Array.from(selectedFiles)
                  .reverse()
                  .map((fileItem) => (
                    <UploadCardRenderer
                      key={fileItem.file.name}
                      isEncrypted={!!fileItem.encInfo}
                      fileItem={fileItem}
                      setMetadata={handleFileMetadata}
                      onRemove={handleRemoveUpload}
                    />
                  ))}
              </UploadBoardContent>
            </Scroll>
          )}
        </UploadBoard>
      )}
      {autocompleteQuery?.prefix === AutocompletePrefix.UserMention && (
        <UserMentionAutocomplete
          room={room}
          editor={editor}
          query={autocompleteQuery}
          requestClose={handleCloseAutocomplete}
        />
      )}
      {autocompleteQuery?.prefix === AutocompletePrefix.Emoticon && (
        <EmoticonAutocomplete
          imagePackRooms={imagePackRooms}
          editor={editor}
          query={autocompleteQuery}
          requestClose={handleCloseAutocomplete}
        />
      )}
      <CustomEditor
        editableName="ThreadInput"
        editor={editor}
        placeholder="Reply in thread..."
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onPaste={handlePaste}
        before={
          <IconButton onClick={() => pickFile('*')} variant="SurfaceVariant" size="300" radii="300">
            <Icon src={Icons.PlusCircle} />
          </IconButton>
        }
        after={
          <>
            <IconButton
              variant="SurfaceVariant"
              size="300"
              radii="300"
              onClick={() => setToolbar(!toolbar)}
            >
              <Icon src={toolbar ? Icons.AlphabetUnderline : Icons.Alphabet} />
            </IconButton>
            <UseStateProvider initial={undefined}>
              {(emojiBoardTab: EmojiBoardTab | undefined, setEmojiBoardTab) => (
                <PopOut
                  offset={16}
                  alignOffset={-44}
                  position="Top"
                  align="End"
                  anchor={
                    emojiBoardTab === undefined
                      ? undefined
                      : (emojiBtnRef.current?.getBoundingClientRect() ?? undefined)
                  }
                  content={
                    <EmojiBoard
                      tab={emojiBoardTab}
                      onTabChange={setEmojiBoardTab}
                      imagePackRooms={imagePackRooms}
                      returnFocusOnDeactivate={false}
                      onEmojiSelect={handleEmoticonSelect}
                      onCustomEmojiSelect={handleEmoticonSelect}
                      requestClose={() => {
                        setEmojiBoardTab((t) => {
                          if (t) {
                            if (!mobileOrTablet()) ReactEditor.focus(editor);
                            return undefined;
                          }
                          return t;
                        });
                      }}
                    />
                  }
                >
                  {!hideStickerBtn && (
                    <IconButton
                      aria-pressed={emojiBoardTab === EmojiBoardTab.Sticker}
                      onClick={() => setEmojiBoardTab(EmojiBoardTab.Sticker)}
                      variant="SurfaceVariant"
                      size="300"
                      radii="300"
                    >
                      <Icon src={Icons.Sticker} filled={emojiBoardTab === EmojiBoardTab.Sticker} />
                    </IconButton>
                  )}
                  <IconButton
                    ref={emojiBtnRef}
                    aria-pressed={
                      hideStickerBtn ? !!emojiBoardTab : emojiBoardTab === EmojiBoardTab.Emoji
                    }
                    onClick={() => setEmojiBoardTab(EmojiBoardTab.Emoji)}
                    variant="SurfaceVariant"
                    size="300"
                    radii="300"
                  >
                    <Icon
                      src={Icons.Smile}
                      filled={
                        hideStickerBtn ? !!emojiBoardTab : emojiBoardTab === EmojiBoardTab.Emoji
                      }
                    />
                  </IconButton>
                </PopOut>
              )}
            </UseStateProvider>
            <IconButton onClick={handleSendReply} variant="SurfaceVariant" size="300" radii="300">
              <Icon src={Icons.Send} />
            </IconButton>
          </>
        }
        bottom={
          toolbar && (
            <div>
              <Line variant="SurfaceVariant" size="300" />
              <Toolbar />
            </div>
          )
        }
      />
    </div>
  );
}

type ThreadInputProps = {
  room: Room;
  activeThreadId: string;
  onMessageSent?: () => void;
};

export function ThreadInput(props: ThreadInputProps) {
  const editor = useEditor();
  return <ThreadInputInner {...props} editor={editor} />;
}
