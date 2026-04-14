import { style } from '@vanilla-extract/css';
import { config, toRem } from 'folds';

export const ThreadDrawerContainer = style({
  width: toRem(480),
  minWidth: toRem(320),
  maxWidth: '50vw',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'auto',
  position: 'relative',
});

export const ResizeHandle = style({
  position: 'absolute',
  top: 0,
  left: 0,
  bottom: 0,
  width: '4px',
  cursor: 'col-resize',
  backgroundColor: 'transparent',
  transition: 'background-color 0.2s',
  ':hover': {
    backgroundColor: 'var(--primary-color)',
  },
});

export const ThreadDrawerHeader = style({
  flexShrink: 0,
  padding: `0 ${config.space.S200} 0 ${config.space.S300}`,
  borderBottomWidth: config.borderWidth.B300,
});

export const ThreadDrawerContent = style({
  flex: 1,
  overflow: 'hidden',
  position: 'relative',
});

export const ThreadMessage = style({
  padding: config.space.S200,
  borderRadius: config.radii.R400,
  backgroundColor: 'var(--surface-variant)',
});

export const MembersDrawer = style({
  width: toRem(266),
});

export const MembersDrawerHeader = style({
  flexShrink: 0,
  padding: `0 ${config.space.S200} 0 ${config.space.S300}`,
  borderBottomWidth: config.borderWidth.B300,
});

export const MemberDrawerContentBase = style({
  position: 'relative',
  overflow: 'hidden',
});
