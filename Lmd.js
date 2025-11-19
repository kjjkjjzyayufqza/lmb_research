// This is a generated file! Please edit source .ksy file and use kaitai-struct-compiler to rebuild

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['exports', 'kaitai-struct/KaitaiStream', './Xmd'], factory);
  } else if (typeof exports === 'object' && exports !== null && typeof exports.nodeType !== 'number') {
    factory(exports, require('kaitai-struct/KaitaiStream'), require('./Xmd'));
  } else {
    factory(root.Lmd || (root.Lmd = {}), root.KaitaiStream, root.Xmd || (root.Xmd = {}));
  }
})(typeof self !== 'undefined' ? self : this, function (Lmd_, KaitaiStream, Xmd_) {
var Lmd = (function() {
  Lmd.BlendMode = Object.freeze({
    NORMAL: 0,
    LAYER: 2,
    MULTIPLY: 3,
    SCREEN: 4,
    LIGHTEN: 5,
    DARKEN: 6,
    DIFFERENCE: 7,
    ADD: 8,
    SUBTRACT: 9,
    INVERT: 10,
    ALPHA: 11,
    ERASE: 12,
    OVERLAY: 13,
    HARD_LIGHT: 14,

    0: "NORMAL",
    2: "LAYER",
    3: "MULTIPLY",
    4: "SCREEN",
    5: "LIGHTEN",
    6: "DARKEN",
    7: "DIFFERENCE",
    8: "ADD",
    9: "SUBTRACT",
    10: "INVERT",
    11: "ALPHA",
    12: "ERASE",
    13: "OVERLAY",
    14: "HARD_LIGHT",
  });

  Lmd.PlacementMode = Object.freeze({
    PLACE: 1,
    MOVE: 2,

    1: "PLACE",
    2: "MOVE",
  });

  Lmd.PositionFlags = Object.freeze({
    TRANSFORM: 0,
    POSITION: 32768,
    NO_TRANSFORM: 65535,

    0: "TRANSFORM",
    32768: "POSITION",
    65535: "NO_TRANSFORM",
  });

  function Lmd(_io, _parent, _root) {
    this._io = _io;
    this._parent = _parent;
    this._root = _root || this;

    this._read();
  }
  Lmd.prototype._read = function() {
    this.xmd = new Xmd_.Xmd(this._io, null, null);
  }

  var Actionscript = Lmd.Actionscript = (function() {
    function Actionscript(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    Actionscript.prototype._read = function() {
      this.bytecode = [];
      var i = 0;
      while (!this._io.isEof()) {
        this.bytecode.push(this._io.readU1());
        i++;
      }
    }

    return Actionscript;
  })();

  var Bounds = Lmd.Bounds = (function() {
    function Bounds(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    Bounds.prototype._read = function() {
      this.numValues = this._io.readU4le();
      this.values = [];
      for (var i = 0; i < this.numValues; i++) {
        this.values.push(new Rect(this._io, this, this._root));
      }
    }

    var Rect = Bounds.Rect = (function() {
      function Rect(_io, _parent, _root) {
        this._io = _io;
        this._parent = _parent;
        this._root = _root;

        this._read();
      }
      Rect.prototype._read = function() {
        this.x = this._io.readF4le();
        this.y = this._io.readF4le();
        this.width = this._io.readF4le();
        this.height = this._io.readF4le();
      }

      return Rect;
    })();

    return Bounds;
  })();

  var Button = Lmd.Button = (function() {
    function Button(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    Button.prototype._read = function() {
      this.characterId = this._io.readU4le();
      this.trackAsMenu = this._io.readBitsIntLe(1) != 0;
      this.unknown = this._io.readBitsIntLe(15);
      this._io.alignToByte();
      this.actionOffset = this._io.readU2le();
      this.boundsId = this._io.readU4le();
      this.unknown2 = this._io.readU4le();
      this.numGraphics = this._io.readU4le();
    }
    Object.defineProperty(Button.prototype, 'numChildren', {
      get: function() {
        if (this._m_numChildren !== undefined)
          return this._m_numChildren;
        this._m_numChildren = this.numGraphics;
        return this._m_numChildren;
      }
    });

    /**
     * graphics are the following tags
     */

    return Button;
  })();

  var Colors = Lmd.Colors = (function() {
    function Colors(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    Colors.prototype._read = function() {
      this.numValues = this._io.readU4le();
      this._raw_values = [];
      this.values = [];
      for (var i = 0; i < this.numValues; i++) {
        this._raw_values.push(this._io.readBytes(8));
        var _io__raw_values = new KaitaiStream(this._raw_values[i]);
        this.values.push(new Color(_io__raw_values, this, this._root));
      }
    }

    var Color = Colors.Color = (function() {
      function Color(_io, _parent, _root) {
        this._io = _io;
        this._parent = _parent;
        this._root = _root;

        this._read();
      }
      Color.prototype._read = function() {
        this.r = this._io.readU2le();
        this.g = this._io.readU2le();
        this.b = this._io.readU2le();
        this.a = this._io.readU2le();
      }

      return Color;
    })();

    return Colors;
  })();

  var DefineSprite = Lmd.DefineSprite = (function() {
    function DefineSprite(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    DefineSprite.prototype._read = function() {
      this.characterId = this._io.readU4le();
      this.nameId = this._io.readU4le();
      this.boundsId = this._io.readU4le();
      this.numFrameLabels = this._io.readU4le();
      this.numFrames = this._io.readU4le();
      this.numKeyframes = this._io.readU4le();
      this.numPlacedObjects = this._io.readU4le();
    }
    Object.defineProperty(DefineSprite.prototype, 'numChildren', {
      get: function() {
        if (this._m_numChildren !== undefined)
          return this._m_numChildren;
        this._m_numChildren = (this.numFrameLabels + this.numFrames) + this.numKeyframes;
        return this._m_numChildren;
      }
    });

    /**
     * don't know if this is correct
     */

    /**
     * don't know if this is correct
     */

    /**
     * labels follow this tag, their respective index is the keyframe id
     */

    /**
     * frames and keyframes may be mixed and come directly after this tag
     */

    return DefineSprite;
  })();

  var Defines = Lmd.Defines = (function() {
    function Defines(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    Defines.prototype._read = function() {
      this.numShapes = this._io.readU4le();
      this.unknown1 = this._io.readU4le();
      this.numSprites = this._io.readU4le();
      this.unknown2 = this._io.readU4le();
      this.numTexts = this._io.readU4le();
      this.unknown3 = [];
      for (var i = 0; i < 3; i++) {
        this.unknown3.push(this._io.readU4le());
      }
    }
    Object.defineProperty(Defines.prototype, 'numChildren', {
      get: function() {
        if (this._m_numChildren !== undefined)
          return this._m_numChildren;
        this._m_numChildren = (this.numSprites + this.numTexts) + this.numShapes;
        return this._m_numChildren;
      }
    });

    return Defines;
  })();

  var DoAction = Lmd.DoAction = (function() {
    function DoAction(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    DoAction.prototype._read = function() {
      this.actionId = this._io.readU4le();
      this.unknown = this._io.readU4le();
    }

    return DoAction;
  })();

  var DynamicText = Lmd.DynamicText = (function() {
    DynamicText.TextAlignment = Object.freeze({
      LEFT: 0,
      RIGHT: 1,
      CENTER: 2,

      0: "LEFT",
      1: "RIGHT",
      2: "CENTER",
    });

    function DynamicText(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    DynamicText.prototype._read = function() {
      this.characterId = this._io.readU4le();
      this.unknown1 = this._io.readU4le();
      this.placeholderText = this._io.readU4le();
      this.unknown2 = this._io.readU4le();
      this.strokeColorId = this._io.readU4le();
      this.unknown3 = [];
      for (var i = 0; i < 3; i++) {
        this.unknown3.push(this._io.readU4le());
      }
      this.alignment = this._io.readU2le();
      this.unknown4 = this._io.readU2le();
      this.unknown5 = [];
      for (var i = 0; i < 2; i++) {
        this.unknown5.push(this._io.readU4le());
      }
      this.size = this._io.readF4le();
      this.unknown6 = [];
      for (var i = 0; i < 4; i++) {
        this.unknown6.push(this._io.readU4le());
      }
    }

    return DynamicText;
  })();

  var Fonts = Lmd.Fonts = (function() {
    function Fonts(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    Fonts.prototype._read = function() {
      this.unknown = this._io.readU4le();
    }

    return Fonts;
  })();

  var Frame = Lmd.Frame = (function() {
    function Frame(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    Frame.prototype._read = function() {
      this.id = this._io.readU4le();
      this.numChildren = this._io.readU4le();
    }

    /**
     * children directly follow this tag, they may be place/remove object or do_action
     */

    return Frame;
  })();

  var FrameLabel = Lmd.FrameLabel = (function() {
    function FrameLabel(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    FrameLabel.prototype._read = function() {
      this.nameId = this._io.readU4le();
      this.startFrame = this._io.readU4le();
    }

    return FrameLabel;
  })();

  var Graphic = Lmd.Graphic = (function() {
    function Graphic(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    Graphic.prototype._read = function() {
      this.atlasId = this._io.readU4le();
      this.fillType = this._io.readU2le();
      this.numVertices = this._io.readU2le();
      this.numIndices = this._io.readU4le();
      this.vertices = [];
      for (var i = 0; i < this.numVertices; i++) {
        this.vertices.push(new Vertex(this._io, this, this._root));
      }
      this.indices = [];
      for (var i = 0; i < this.numIndices; i++) {
        this.indices.push(this._io.readU2le());
      }
    }

    var Vertex = Graphic.Vertex = (function() {
      function Vertex(_io, _parent, _root) {
        this._io = _io;
        this._parent = _parent;
        this._root = _root;

        this._read();
      }
      Vertex.prototype._read = function() {
        this.x = this._io.readF4le();
        this.y = this._io.readF4le();
        this.u = this._io.readF4le();
        this.v = this._io.readF4le();
      }

      return Vertex;
    })();

    return Graphic;
  })();

  var LmbType = Lmd.LmbType = (function() {
    function LmbType(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    LmbType.prototype._read = function() {
      this.magic = this._io.readBytes(4);
      if (!((KaitaiStream.byteArrayCompare(this.magic, new Uint8Array([76, 77, 66, 0])) == 0))) {
        throw new KaitaiStream.ValidationNotEqualError(new Uint8Array([76, 77, 66, 0]), this.magic, this._io, "/types/lmb_type/seq/0");
      }
      this.textureId = this._io.readU4le();
      this.resourceId = this._io.readU4le();
      this._raw_xmdPadding = this._io.readBytes(4);
      var _io__raw_xmdPadding = new KaitaiStream(this._raw_xmdPadding);
      this.xmdPadding = new Nothing(_io__raw_xmdPadding, this, this._root);
      this.numPadding = this._io.readU4le();
      this.unknown4 = this._io.readU4le();
      this.unknown5 = this._io.readU4le();
      this.totalFileLen = this._io.readU4le();
      this.padding = [];
      for (var i = 0; i < this.numPadding; i++) {
        this.padding.push(this._io.readBytes(16));
      }
      this.tags = [];
      var i = 0;
      while (!this._io.isEof()) {
        this.tags.push(new Tag(this._io, this, this._root));
        i++;
      }
    }

    return LmbType;
  })();

  var Nothing = Lmd.Nothing = (function() {
    function Nothing(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    Nothing.prototype._read = function() {
    }

    return Nothing;
  })();

  var PlaceObject = Lmd.PlaceObject = (function() {
    function PlaceObject(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    PlaceObject.prototype._read = function() {
      this.characterId = this._io.readS4le();
      this.placementId = this._io.readS4le();
      this.unknown1 = this._io.readU4le();
      this.nameId = this._io.readU4le();
      this.placementMode = this._io.readU2le();
      this.blendMode = this._io.readU2le();
      this.depth = this._io.readU2le();
      this.unknown2 = this._io.readU2le();
      this.unknown3 = this._io.readU2le();
      this.unknown4 = this._io.readU2le();
      this.positionId = this._io.readS2le();
      this.positionFlags = this._io.readU2le();
      this.colorMultId = this._io.readS4le();
      this.colorAddId = this._io.readS4le();
      this.hasColorMatrix = this._io.readU4le();
      this.hasUnknownF014 = this._io.readU4le();
    }
    Object.defineProperty(PlaceObject.prototype, 'numChildren', {
      get: function() {
        if (this._m_numChildren !== undefined)
          return this._m_numChildren;
        this._m_numChildren = this.hasColorMatrix + this.hasUnknownF014;
        return this._m_numChildren;
      }
    });

    /**
     * This is conditionally a position id, transform id, or nothing (-1) depending on position_flags
     */

    return PlaceObject;
  })();

  var Positions = Lmd.Positions = (function() {
    function Positions(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    Positions.prototype._read = function() {
      this.numValues = this._io.readU4le();
      this.values = [];
      for (var i = 0; i < this.numValues; i++) {
        this.values.push(new Position(this._io, this, this._root));
      }
    }

    var Position = Positions.Position = (function() {
      function Position(_io, _parent, _root) {
        this._io = _io;
        this._parent = _parent;
        this._root = _root;

        this._read();
      }
      Position.prototype._read = function() {
        this.x = this._io.readF4le();
        this.y = this._io.readF4le();
      }

      return Position;
    })();

    return Positions;
  })();

  var Properties = Lmd.Properties = (function() {
    function Properties(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    Properties.prototype._read = function() {
      this.unknown = this._io.readBytes(3 * 4);
      this.maxCharacterId = this._io.readU4le();
      this.unknown2 = this._io.readU4le();
      this.entryCharacterId = this._io.readU4le();
      this.maxDepth = this._io.readU2le();
      this.unknown3 = this._io.readU2le();
      this.framerate = this._io.readF4le();
      this.width = this._io.readF4le();
      this.height = this._io.readF4le();
      this.unknown4 = this._io.readBytes(2 * 4);
    }

    return Properties;
  })();

  var RemoveObject = Lmd.RemoveObject = (function() {
    function RemoveObject(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    RemoveObject.prototype._read = function() {
      this.unknown1 = this._io.readU4le();
      this.depth = this._io.readU2le();
      this.unknown2 = this._io.readU2le();
    }

    return RemoveObject;
  })();

  var Symbols = Lmd.Symbols = (function() {
    function Symbols(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    Symbols.prototype._read = function() {
      this.numValues = this._io.readU4le();
      this.values = [];
      for (var i = 0; i < this.numValues; i++) {
        this.values.push(new String(this._io, this, this._root));
      }
    }

    var String = Symbols.String = (function() {
      function String(_io, _parent, _root) {
        this._io = _io;
        this._parent = _parent;
        this._root = _root;

        this._read();
      }
      String.prototype._read = function() {
        this.len = this._io.readU4le();
        this.value = KaitaiStream.bytesToStr(this._io.readBytes(this.len), "UTF-8");
        this._raw_padding = this._io.readBytes(4 - KaitaiStream.mod(this.len, 4));
        var _io__raw_padding = new KaitaiStream(this._raw_padding);
        this.padding = new Nothing(_io__raw_padding, this, this._root);
      }

      return String;
    })();

    return Symbols;
  })();

  /**
   * tags are read from top to bottom
   * BE CAREFUL:
   * Any tag can depend on any other tag that comes before it.
   * So while resolving references keep that in mind.
   * However also by spec, a tag cannot depend on tags that
   * come after it.
   */

  var Tag = Lmd.Tag = (function() {
    Tag.FlashTagType = Object.freeze({
      SHOW_FRAME: 1,
      PLACE_OBJECT: 4,
      REMOVE_OBJECT: 5,
      FONTS: 10,
      DO_ACTION: 12,
      DYNAMIC_TEXT: 37,
      DEFINE_SPRITE: 39,
      FRAME_LABEL: 43,
      SYMBOLS: 61441,
      COLORS: 61442,
      TRANSFORMS: 61443,
      BOUNDS: 61444,
      ACTION_SCRIPT: 61445,
      TEXTURE_ATLASES: 61447,
      UNKNOWN_F008: 61448,
      UNKNOWN_F009: 61449,
      UNKNOWN_F00A: 61450,
      UNKNOWN_F00B: 61451,
      PROPERTIES: 61452,
      DEFINES: 61453,
      PLAY_SOUND: 61460,
      BUTTON: 61474,
      GRAPHIC: 61476,
      COLOR_MATRIX: 61495,
      POSITIONS: 61699,
      KEYFRAME: 61701,
      END: 65280,
      ACTION_SCRIPT_2: 65285,

      1: "SHOW_FRAME",
      4: "PLACE_OBJECT",
      5: "REMOVE_OBJECT",
      10: "FONTS",
      12: "DO_ACTION",
      37: "DYNAMIC_TEXT",
      39: "DEFINE_SPRITE",
      43: "FRAME_LABEL",
      61441: "SYMBOLS",
      61442: "COLORS",
      61443: "TRANSFORMS",
      61444: "BOUNDS",
      61445: "ACTION_SCRIPT",
      61447: "TEXTURE_ATLASES",
      61448: "UNKNOWN_F008",
      61449: "UNKNOWN_F009",
      61450: "UNKNOWN_F00A",
      61451: "UNKNOWN_F00B",
      61452: "PROPERTIES",
      61453: "DEFINES",
      61460: "PLAY_SOUND",
      61474: "BUTTON",
      61476: "GRAPHIC",
      61495: "COLOR_MATRIX",
      61699: "POSITIONS",
      61701: "KEYFRAME",
      65280: "END",
      65285: "ACTION_SCRIPT_2",
    });

    function Tag(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    Tag.prototype._read = function() {
      this.tagType = this._io.readU2le();
      this.offset = this._io.readU2le();
      if (!( ((this.offset == 0)) )) {
        throw new KaitaiStream.ValidationNotAnyOfError(this.offset, this._io, "/types/tag/seq/1");
      }
      this.dataLen = this._io.readU4le();
      switch (this.tagType) {
      case Lmd.Tag.FlashTagType.ACTION_SCRIPT:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new Actionscript(_io__raw_data, this, this._root);
        break;
      case Lmd.Tag.FlashTagType.BOUNDS:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new Bounds(_io__raw_data, this, this._root);
        break;
      case Lmd.Tag.FlashTagType.BUTTON:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new Button(_io__raw_data, this, this._root);
        break;
      case Lmd.Tag.FlashTagType.COLORS:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new Colors(_io__raw_data, this, this._root);
        break;
      case Lmd.Tag.FlashTagType.DEFINE_SPRITE:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new DefineSprite(_io__raw_data, this, this._root);
        break;
      case Lmd.Tag.FlashTagType.DEFINES:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new Defines(_io__raw_data, this, this._root);
        break;
      case Lmd.Tag.FlashTagType.DO_ACTION:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new DoAction(_io__raw_data, this, this._root);
        break;
      case Lmd.Tag.FlashTagType.DYNAMIC_TEXT:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new DynamicText(_io__raw_data, this, this._root);
        break;
      case Lmd.Tag.FlashTagType.FONTS:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new Fonts(_io__raw_data, this, this._root);
        break;
      case Lmd.Tag.FlashTagType.FRAME_LABEL:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new FrameLabel(_io__raw_data, this, this._root);
        break;
      case Lmd.Tag.FlashTagType.GRAPHIC:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new Graphic(_io__raw_data, this, this._root);
        break;
      case Lmd.Tag.FlashTagType.KEYFRAME:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new Frame(_io__raw_data, this, this._root);
        break;
      case Lmd.Tag.FlashTagType.PLACE_OBJECT:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new PlaceObject(_io__raw_data, this, this._root);
        break;
      case Lmd.Tag.FlashTagType.POSITIONS:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new Positions(_io__raw_data, this, this._root);
        break;
      case Lmd.Tag.FlashTagType.PROPERTIES:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new Properties(_io__raw_data, this, this._root);
        break;
      case Lmd.Tag.FlashTagType.REMOVE_OBJECT:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new RemoveObject(_io__raw_data, this, this._root);
        break;
      case Lmd.Tag.FlashTagType.SHOW_FRAME:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new Frame(_io__raw_data, this, this._root);
        break;
      case Lmd.Tag.FlashTagType.SYMBOLS:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new Symbols(_io__raw_data, this, this._root);
        break;
      case Lmd.Tag.FlashTagType.TEXTURE_ATLASES:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new TextureAtlases(_io__raw_data, this, this._root);
        break;
      case Lmd.Tag.FlashTagType.TRANSFORMS:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new Transforms(_io__raw_data, this, this._root);
        break;
      default:
        this._raw_data = this._io.readBytes(this.dataLen * 4);
        var _io__raw_data = new KaitaiStream(this._raw_data);
        this.data = new Nothing(_io__raw_data, this, this._root);
        break;
      }
      this.children = [];
      for (var i = 0; i < (this.tagType == Lmd.Tag.FlashTagType.DEFINES ? this.data.numChildren : (this.tagType == Lmd.Tag.FlashTagType.KEYFRAME ? this.data.numChildren : (this.tagType == Lmd.Tag.FlashTagType.SHOW_FRAME ? this.data.numChildren : (this.tagType == Lmd.Tag.FlashTagType.DEFINE_SPRITE ? this.data.numChildren : (this.tagType == Lmd.Tag.FlashTagType.BUTTON ? this.data.numChildren : (this.tagType == Lmd.Tag.FlashTagType.PLACE_OBJECT ? this.data.numChildren : 0)))))); i++) {
        this.children.push(new Tag(this._io, this, this._root));
      }
    }

    return Tag;
  })();

  var TextureAtlases = Lmd.TextureAtlases = (function() {
    function TextureAtlases(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    TextureAtlases.prototype._read = function() {
      this.numValues = this._io.readU4le();
      this.values = [];
      for (var i = 0; i < this.numValues; i++) {
        this.values.push(new TextureAtlas(this._io, this, this._root));
      }
    }

    var TextureAtlas = TextureAtlases.TextureAtlas = (function() {
      function TextureAtlas(_io, _parent, _root) {
        this._io = _io;
        this._parent = _parent;
        this._root = _root;

        this._read();
      }
      TextureAtlas.prototype._read = function() {
        this.id = this._io.readU4le();
        this.nameId = this._io.readU4le();
        this.width = this._io.readF4le();
        this.height = this._io.readF4le();
      }

      return TextureAtlas;
    })();

    return TextureAtlases;
  })();

  var TexturesType = Lmd.TexturesType = (function() {
    function TexturesType(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    TexturesType.prototype._read = function() {
      this.textureHashes = [];
      var i = 0;
      while (!this._io.isEof()) {
        this.textureHashes.push(this._io.readU4le());
        i++;
      }
    }

    return TexturesType;
  })();

  var Transforms = Lmd.Transforms = (function() {
    function Transforms(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    Transforms.prototype._read = function() {
      this.numValues = this._io.readU4le();
      this.values = [];
      for (var i = 0; i < this.numValues; i++) {
        this.values.push(new Matrix(this._io, this, this._root));
      }
    }

    var Matrix = Transforms.Matrix = (function() {
      function Matrix(_io, _parent, _root) {
        this._io = _io;
        this._parent = _parent;
        this._root = _root;

        this._read();
      }
      Matrix.prototype._read = function() {
        this.a = this._io.readF4le();
        this.b = this._io.readF4le();
        this.c = this._io.readF4le();
        this.d = this._io.readF4le();
        this.x = this._io.readF4le();
        this.y = this._io.readF4le();
      }

      return Matrix;
    })();

    return Transforms;
  })();
  Object.defineProperty(Lmd.prototype, 'lmb', {
    get: function() {
      if (this._m_lmb !== undefined)
        return this._m_lmb;
      var _pos = this._io.pos;
      this._io.seek(this.xmd.positions[0]);
      this._raw__m_lmb = this._io.readBytes(this.xmd.lengths[0]);
      var _io__raw__m_lmb = new KaitaiStream(this._raw__m_lmb);
      this._m_lmb = new LmbType(_io__raw__m_lmb, this, this._root);
      this._io.seek(_pos);
      return this._m_lmb;
    }
  });
  Object.defineProperty(Lmd.prototype, 'references', {
    get: function() {
      if (this._m_references !== undefined)
        return this._m_references;
      var _pos = this._io.pos;
      this._io.seek(this.xmd.positions[2]);
      this._m_references = this._io.readBytes(this.xmd.lengths[2]);
      this._io.seek(_pos);
      return this._m_references;
    }
  });
  Object.defineProperty(Lmd.prototype, 'textures', {
    get: function() {
      if (this._m_textures !== undefined)
        return this._m_textures;
      var _pos = this._io.pos;
      this._io.seek(this.xmd.positions[1]);
      this._raw__m_textures = this._io.readBytes(this.xmd.lengths[1]);
      var _io__raw__m_textures = new KaitaiStream(this._raw__m_textures);
      this._m_textures = new TexturesType(_io__raw__m_textures, this, this._root);
      this._io.seek(_pos);
      return this._m_textures;
    }
  });

  return Lmd;
})();
Lmd_.Lmd = Lmd;
});
