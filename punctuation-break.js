'use strict';

module.exports = (originalText, oneLineLength, padding) => {
  const breakRegExp = new RegExp('\n|\r\n|\r');
  const breakSplit = originalText.split(breakRegExp);
  let text = [];
  let wordCount = 0;

  // 改行分割ループ
  for (let i = 0; i < breakSplit.length; i++) {
    const splitText = breakSplit[i].split('');

    // 改行のみだったときの処理
    if (splitText.length === 0) {
      if (padding) {
        for (let i = 0; i < (oneLineLength - wordCount); i++) {
          text.push('　');
        }
      } else {
        text.push('\n');
      }
      continue;
    }

    // 一文字分割ループ
    for (let i = 0; i < splitText.length; i++) {
      text.push(splitText[i]);
      wordCount++;

      // 禁則処理
      if ((wordCount === 1) && (['。', '、'].includes(splitText[i]))) {
        if (padding) {
          if ((text.length - 2) >= 0) {
            text.splice(text.length - 2, 0, '　');
          }
        } else {
          if ((text.length - 3) >= 0) {
            text.splice(text.length - 3, 0, '\n');
            text.splice(text.length - 2, 1);
          }
        }
        wordCount++;
      }

      // 行の最後に改行を入れる
      if (i === (splitText.length - 1)) {
        if (padding) {
          for (let i = 0; i < (oneLineLength - wordCount); i++) {
            text.push('　');
          }
        } else {
          text.push('\n');
        }
        wordCount = 0;
        continue;
      }

      // 途中で改行を入れる
      if (wordCount === oneLineLength) {
        if (!padding) {
          text.push('\n');
        }
        wordCount = 0;
      }
    }

    wordCount = 0;
  }

  return text.join('');
}
