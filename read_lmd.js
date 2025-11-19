const fs = require('fs')
const KaitaiStream = require('kaitai-struct').KaitaiStream
const { Lmd } = require('./Lmd')

const fileName = 'CMN_ALLNET_ICON00.lmd'
const buffer = fs.readFileSync(fileName)
console.log('Buffer length = ' + buffer.length)
const lmd = new Lmd(new KaitaiStream(buffer))

console.log(
  'Magic = ',
  new TextDecoder().decode(lmd.lmb.magic).replace(/\0/g, '')
)
console.log('Texture ID = ', lmd.lmb.textureId)
console.log('Resource ID = ', lmd.lmb.resourceId)
console.log('Tags Count = ', lmd.lmb.tags.length)
