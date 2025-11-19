const fs = require('fs')
const KaitaiStream = require('kaitai-struct').KaitaiStream
const { Lmb } = require('./Lmb')

const fileName = 'CMN_ALLNET_ICON00.lmb'
const buffer = fs.readFileSync(fileName)
console.log('Buffer length = ' + buffer.length)
const lmb = new Lmb(new KaitaiStream(buffer))

console.log(
  'Magic = ',
  new TextDecoder().decode(lmb.lmb.magic).replace(/\0/g, '')
)
console.log('Texture ID = ', lmb.lmb.textureId)
console.log('Resource ID = ', lmb.lmb.resourceId)
console.log('Tags Count = ', lmb.lmb.tags.length)
