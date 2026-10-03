/**
 * One heading treatment for every section of the reminder editor.
 *
 * The sections had each grown a `titleLarge` heading — "Media", "When",
 * "After the reminder", "Alert style" — four 22 sp headings competing with
 * the content between them and with the screen's own app-bar title, so a
 * form of five short sections read as five pages stacked together. This is
 * the same quiet uppercase label Home uses over NEXT and ALL REMINDERS, so
 * sectioning looks the same wherever it appears in the app.
 */
import {Text} from '../../../design-system';

export interface EditorSectionHeadingProps {
  readonly label: string;
}

export function EditorSectionHeading({label}: EditorSectionHeadingProps) {
  return (
    <Text variant="labelLarge" tone="variant" isHeading>
      {label.toUpperCase()}
    </Text>
  );
}
