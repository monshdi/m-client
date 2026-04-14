import { style } from '@vanilla-extract/css';
import { DefaultReset, config, toRem, color } from 'folds';

export const MessageBase = style({
  position: 'relative',
});
export const MessageBaseBubbleCollapsed = style({
  paddingTop: 0,
});

export const MessageOptionsBase = style([
  DefaultReset,
  {
    position: 'absolute',
    top: toRem(-30),
    right: 0,
    zIndex: 1,
  },
]);
export const MessageOptionsBar = style([
  DefaultReset,
  {
    padding: config.space.S100,
  },
]);

export const BubbleAvatarBase = style({
  paddingTop: 0,
});

export const MessageAvatar = style({
  cursor: 'pointer',
});

export const MessageQuickReaction = style({
  minWidth: toRem(32),
});

export const MessageMenuGroup = style({
  padding: config.space.S100,
});

export const MessageMenuItemText = style({
  flexGrow: 1,
});

export const ReactionsContainer = style({
  selectors: {
    '&:empty': {
      display: 'none',
    },
  },
});

export const ReactionsTooltipText = style({
  wordBreak: 'break-word',
});

export const ThreadIndicator = style([
  DefaultReset,
  {
    display: 'flex',
    gap: config.space.S100,
    padding: `${config.space.S100} ${config.space.S200}`,
    marginTop: config.space.S200,
    borderRadius: config.radii.R300,
    backgroundColor: color.SurfaceVariant.Container,
    color: color.SurfaceVariant.OnContainer,
    borderColor: color.SurfaceVariant.OnContainer,
    border: '1px solid',
    cursor: 'pointer',
    textOverflow: 'ellipsis',
    fontSize: toRem(12),
    // width: 'fit-content',
    ':hover': {
      backgroundColor: color.SurfaceVariant.ContainerActive,
    },
  },
]);
