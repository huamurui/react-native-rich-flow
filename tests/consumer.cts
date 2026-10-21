import richFlow = require('react-native-rich-flow');
const result: string = richFlow.getRichTextSelectionText({ text: 'Hello', attachments: [] }, 0, 5);
const valid: boolean = richFlow.isValidTextRange(result, 0, 1);
void valid;
