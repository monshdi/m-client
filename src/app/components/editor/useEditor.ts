import { createEditor, Editor } from 'slate';
import { useMemo } from 'react';
import { withReact } from 'slate-react';
import { withHistory } from 'slate-history';
import { BlockType } from './types';

export default function useEditor(deps: unknown[]) {
  const withInline = (editor: Editor): Editor => {
    const { isInline } = editor;

    editor.isInline = (element) =>
      [BlockType.Mention, BlockType.Emoticon, BlockType.Link, BlockType.Command].includes(
        element.type
      ) || isInline(element);

    return editor;
  };

  const withVoid = (editor: Editor): Editor => {
    const { isVoid } = editor;

    editor.isVoid = (element) =>
      [BlockType.Mention, BlockType.Emoticon, BlockType.Command].includes(element.type) ||
      isVoid(element);

    return editor;
  };

  const editor = useMemo(() => withInline(withVoid(withReact(withHistory(createEditor())))), deps);
  
  // const [editor] = useState(() => withInline(withVoid(withReact(withHistory(createEditor())))));
  return editor;
}