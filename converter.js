'use strict';

const jimp = require('jimp');
const punctuationBreak = require('./punctuation-break.js');
const shinonome12 = require('./shinonome12.json');

module.exports = converter;
function converter (width, height, margin) {
  if (!(Number.isInteger(width) && ((width % 8) === 0))) {
    throw new Error('width is invalid');
  }
  if (!(Number.isInteger(height))) {
    throw new Error('height is invalid');
  }

  this.fontSize = 12;
  this.width = width;
  this.height = height;
  this.rowLength = Math.floor(this.width / this.fontSize);
  this.colLength = Math.floor(this.height / this.fontSize);

  if (margin) {
    if (!(Number.isInteger(margin.top)
     && Number.isInteger(margin.left)
     && Number.isInteger(margin.right)
     && Number.isInteger(margin.bottom)
     && ((margin.top + margin.bottom) === (this.height % this.fontSize))
     && ((margin.left + margin.right) === (this.width % this.fontSize)))) {
       throw new Error('margin is invalid');
     }
     this.margin = margin;
  } else {
    this.margin = calcMargin(this.width, this.height, this.fontSize);
  }
}

function calcMargin (width, height, fontSize) {
  let margin = {};
  const remainder = {
    width: width % fontSize,
    height: height % fontSize
  };
  margin.top = Math.floor(remainder.height / 2);
  margin.left = Math.floor(remainder.width / 2);
  margin.right = remainder.width - margin.left;
  margin.bottom = remainder.height - margin.top;
  return margin;
}

converter.prototype.text2binary = function (text) {
  const config = this;

  // 半角文字を全角に変換
  const emText = text.replace(new RegExp('[A-Za-z0-9!-~]', 'g'), (match) => {
    return String.fromCharCode(match.charCodeAt(0) + 0xFEE0);
  });
  // 禁則処理
  const breakText = punctuationBreak(emText, config.rowLength, true);
  //ページを分割
  const pages = splitByLength(
    breakText,
    (config.rowLength * config.colLength),
    true
  );
  // 複数ページ
  let binaryArray = [];

  // ページループ
  for (let i = 0; i < pages.length; i++) {
    let binary = '';
    const lineSplit = splitByLength(pages[i], config.rowLength);

    // margin top生成ループ
    for (let i = 0; i < config.margin.top; i++) {
      const pixelNum = config.margin.left
       + (config.rowLength * config.fontSize)
       + config.margin.right;
      binary += new Array(pixelNum).fill('1').join('');
    }

    // 一行テキスト生成ループ
    for (let i = 0; i < lineSplit.length; i++) {
      binary += createTextBinary(lineSplit[i], config);
    }

    // margin bottom生成ループ
    for (let i = 0; i < config.margin.bottom; i++) {
      const pixelNum = config.margin.left
       + (config.rowLength * config.fontSize)
       + config.margin.right;
      binary += new Array(pixelNum).fill('1').join('');
    }

    binaryArray.push(binary);
  }

  return binaryArray;
}

function createTextBinary (text, config) {
  // テキストを一文字ずつ分割
  const charSplit = text.split('');
  // binary配列
  let lineBinary = new Array(config.fontSize);

  // 文字生成ループ
  for (let i = 0; i < charSplit.length; i++) {
    // 文字のbitmapを取得
    let charBitmap = getCharBitmap(charSplit[i]);
    if (charBitmap === null) {
      // shinonome12に文字が無かったら全角スペースで置換
      charBitmap = getCharBitmap('　');
    }

    // 文字のbitmapを配列に追加するループ
    for (let i = 0; i < charBitmap.length; i++) {
      // margin left生成
      if (!lineBinary[i]) {
        lineBinary[i] = new Array(config.margin.left).fill('0').join('');
      }

      // 文字のbitmapを配列に追加
      lineBinary[i] += charBitmap[i];

      // margin right生成
      if (lineBinary[i].length === (
        config.margin.left +
        text.length *
        config.fontSize
      )) {
        lineBinary[i] += new Array(config.margin.right).fill('0').join('');
      }
    }
  }

  return reverseBinary(lineBinary.join(''));
}

function getCharBitmap (char) {
  if (!shinonome12[char]) {
    return null;
  }
  return shinonome12[char].bitmap;
}

converter.prototype.image2binary = function (path) {
  const config = this;
  return new Promise((resolve, reject) => {
    jimp.read(path).then((image) => {
      image
      .contain(config.width, config.height)
      .background(0xFFFFFFFF)
      .greyscale()
      .write(__dirname + '/.tmp');
      resolve(reduceChannel(image.bitmap.data));
    }).catch((err) => {
      reject(err);
    });
  });
}

function reduceChannel (buffer) {
  let binary = '';
  for (let i = 0; i < (buffer.length / 4); i++) {
    if (buffer[i * 4] >= (255 / 4 * 3)) {
      binary += '1';
    } else {
      binary += '0';
    }
  }
  return binary;
}

converter.prototype.addProgressBar = function (bufferArray) {
  const config = this;
  for (let i = 0; i < bufferArray.length; i++) {
    let percent;
    if (i === (bufferArray.length - 1)) {
      percent = 100;
    } else {
      percent = Math.round(i / bufferArray.length * 100);
    }
    const progressBuffer = createProgressBuffer(percent, config.width);
    bufferArray[i] = Buffer.concat([bufferArray[i], progressBuffer]);
  }
  return bufferArray;
}

function createProgressBuffer (percent, width) {
  const config = {
    width: width,
    progress: parseInt((width - 12) * percent / 100)
  };

  const bitArray = [
    ['1', config.width],                          // 1
    ['1', 5],                                     // 2
    ['0', config.width - 10],
    ['1', 5],
    ['1', 4],                                     // 3
    ['0', 1],
    ['1', config.width - 10],
    ['0', 1],
    ['1', 4],
    ['1', 4],                                     // 4
    ['0', 1],
    ['1', 1],
    ['0', config.progress],
    ['1', (config.width - 12) - config.progress],
    ['1', 1],
    ['0', 1],
    ['1', 4],
    ['1', 4],                                     // 5
    ['0', 1],
    ['1', 1],
    ['0', config.progress],
    ['1', (config.width - 12) - config.progress],
    ['1', 1],
    ['0', 1],
    ['1', 4],
    ['1', 4],                                     // 6
    ['0', 1],
    ['1', config.width - 10],
    ['0', 1],
    ['1', 4],
    ['1', 5],                                     // 7
    ['0', config.width - 10],
    ['1', 5],
    ['1', config.width * 5]                       // 8, 9, 10, 11, 12
  ];

  let binary = '';
  for (let i = 0; i < bitArray.length; i++) {
    binary += new Array(bitArray[i][1]).fill(bitArray[i][0]).join('');
  }

  return converter.prototype.binary2buffer(binary);
}

converter.prototype.binary2buffer = function (binary) {
  let hexArray = [];
  const lengthSplit = splitByLength(binary, 8);
  for (let i = 0; i < lengthSplit.length; i++) {
    const hex = '0x' + zeroPadding(parseInt(lengthSplit[i], 2).toString(16), 2);
    hexArray.push(hex);
  }
  return Buffer.from(hexArray);
}

function zeroPadding (num, length) {
  return (new Array(length).fill('0').join('') + num).slice(-length);
}

function splitByLength (text, length, padding = false) {
  let result = [];
  let begin = 0;
  let end = begin + length;

  for (let i = 0; begin < text.length; i++) {
    let slice = text.slice(begin, end);
    if (padding && (slice.length < length)) {
      slice += new Array(length - slice.length).fill('　').join('');
    }
    result[i] = slice;
    begin = end;
    end = begin + length;
  }

  return result;
}

function reverseBinary (binary) {
  return binary
  .replace(new RegExp('0', 'g'), 'A')
  .replace(new RegExp('1', 'g'), '0')
  .replace(new RegExp('A', 'g'), '1');
}
