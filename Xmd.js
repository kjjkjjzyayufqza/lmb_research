// This is a generated file! Please edit source .ksy file and use kaitai-struct-compiler to rebuild

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['exports', 'kaitai-struct/KaitaiStream'], factory);
  } else if (typeof exports === 'object' && exports !== null && typeof exports.nodeType !== 'number') {
    factory(exports, require('kaitai-struct/KaitaiStream'));
  } else {
    factory(root.Xmd || (root.Xmd = {}), root.KaitaiStream);
  }
})(typeof self !== 'undefined' ? self : this, function (Xmd_, KaitaiStream) {
var Xmd = (function() {
  Xmd.ListCounts = Object.freeze({
    LMB_TEXTURES_RESOURCES: 1,
    POS_LEN_ID: 3,

    1: "LMB_TEXTURES_RESOURCES",
    3: "POS_LEN_ID",
  });

  function Xmd(_io, _parent, _root) {
    this._io = _io;
    this._parent = _parent;
    this._root = _root || this;

    this._read();
  }
  Xmd.prototype._read = function() {
    this.header = new XmdHeader(this._io, this, this._root);
    this.positions = [];
    for (var i = 0; i < this.header.alignedCount; i++) {
      this.positions.push(this._io.readU4le());
    }
    this.lengths = [];
    for (var i = 0; i < this.header.alignedCount; i++) {
      this.lengths.push(this._io.readU4le());
    }
    this.itemIds = [];
    for (var i = 0; i < this.header.alignedCount; i++) {
      this.itemIds.push(this._io.readU4le());
    }
  }

  var XmdHeader = Xmd.XmdHeader = (function() {
    function XmdHeader(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    XmdHeader.prototype._read = function() {
      this.signature = this._io.readBytes(8);
      if (!((KaitaiStream.byteArrayCompare(this.signature, new Uint8Array([88, 77, 68, 0, 48, 48, 49, 0])) == 0))) {
        throw new KaitaiStream.ValidationNotEqualError(new Uint8Array([88, 77, 68, 0, 48, 48, 49, 0]), this.signature, this._io, "/types/xmd_header/seq/0");
      }
      this.layout = this._io.readU4le();
      this.count = this._io.readU4le();
    }
    Object.defineProperty(XmdHeader.prototype, 'alignedCount', {
      get: function() {
        if (this._m_alignedCount !== undefined)
          return this._m_alignedCount;
        this._m_alignedCount = this.count + KaitaiStream.mod(4 - this.count, 4);
        return this._m_alignedCount;
      }
    });

    return XmdHeader;
  })();

  return Xmd;
})();
Xmd_.Xmd = Xmd;
});
