self.onmessage = ({ data }) => {
  try {
    const { pattern, flags, text, replacement } = data;
    const expression = new RegExp(pattern, flags);
    const matches = [];
    let match;
    while ((match = expression.exec(text)) !== null) {
      matches.push({ index: match.index, text: match[0], captures: match.slice(1), groups: match.groups || null });
      if (matches.length >= 1000 || (!expression.global && !expression.sticky)) break;
      if (!match[0].length) {
        const index = expression.lastIndex;
        expression.lastIndex += (expression.unicode || expression.unicodeSets) && text.codePointAt(index) > 0xffff ? 2 : 1;
      }
    }
    self.postMessage({ matches, output: text.replace(new RegExp(pattern, flags), replacement), capped: matches.length >= 1000 });
  } catch (error) { self.postMessage({ error: error.message }); }
};
