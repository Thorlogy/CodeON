ace.define(
  "ace/mode/nqc_highlight_rules",
  [
    "require",
    "exports",
    "module",
    "ace/lib/oop",
    "ace/mode/text_highlight_rules",
  ],
  function (require, exports) {
    "use strict";

    var oop = require("../lib/oop");
    var TextHighlightRules =
      require("./text_highlight_rules").TextHighlightRules;
    var NqcHighlightRules = function () {
      var keywordMapper = this.createKeywordMapper(
        {
          "keyword.control":
            "task|sub|repeat|until|forever|if|else|for|while|do|break|continue|return",
          "storage.type": "int|long|short|bool|float|void",
          "support.function":
            "SetPower|OnFwd|OnRev|Off|Float|Wait|PlayTone|SetUserDisplay|SelectDisplay|ClearTimer|ClearSensor|SetSensor|FastTimer|Random|MIN|MAX|NEPO_PWR",
          "constant.language":
            "OUT_A|OUT_B|OUT_C|SENSOR_1|SENSOR_2|SENSOR_3|SENSOR_TOUCH|SENSOR_LIGHT|SENSOR_ROTATION|SENSOR_CELSIUS|DISPLAY_WATCH|true|false|null",
          "entity.name.function": "main",
        },
        "identifier"
      );

      this.$rules = {
        start: [
          { token: "comment", regex: "\\/\\/", next: "lineComment" },
          { token: "comment", regex: "\\/\\*", next: "blockComment" },
          { token: "string", regex: '"(?:\\\\.|[^"\\\\])*"' },
          { token: "string", regex: "'(?:\\\\.|[^'\\\\])'" },
          {
            token: "keyword",
            regex:
              "#\\s*(?:define|undef|include|if|ifdef|ifndef|else|elif|endif)\\b",
          },
          {
            token: "constant.numeric",
            regex: "\\b(?:0[xX][0-9a-fA-F]+|[0-9]+(?:\\.[0-9]+)?)\\b",
          },
          { token: keywordMapper, regex: "[a-zA-Z_$][a-zA-Z0-9_$]*\\b" },
          {
            token: "keyword.operator",
            regex: "--|\\+\\+|&&|\\|\\||<<|>>|[+\\-*\\/%=!<>]=?|[&|^~]",
          },
          { token: "punctuation.operator", regex: "[?:,;.]" },
          { token: "paren.lparen", regex: "[[({]" },
          { token: "paren.rparen", regex: "[\\])}]" },
          { token: "text", regex: "\\s+" },
        ],
        lineComment: [
          { token: "comment", regex: "$", next: "start" },
          { defaultToken: "comment" },
        ],
        blockComment: [
          { token: "comment", regex: "\\*\\/", next: "start" },
          { defaultToken: "comment" },
        ],
      };
      this.normalizeRules();
    };

    oop.inherits(NqcHighlightRules, TextHighlightRules);
    exports.NqcHighlightRules = NqcHighlightRules;
  }
);

ace.define(
  "ace/mode/nqc",
  [
    "require",
    "exports",
    "module",
    "ace/lib/oop",
    "ace/mode/text",
    "ace/mode/nqc_highlight_rules",
    "ace/range",
  ],
  function (require, exports) {
    "use strict";

    var oop = require("../lib/oop");
    var TextMode = require("./text").Mode;
    var NqcHighlightRules = require("./nqc_highlight_rules").NqcHighlightRules;
    var Range = require("../range").Range;
    var Mode = function () {
      this.HighlightRules = NqcHighlightRules;
      this.$behaviour = this.$defaultBehaviour;
      this.$id = "ace/mode/nqc";
    };

    oop.inherits(Mode, TextMode);
    Mode.prototype.lineCommentStart = "//";
    Mode.prototype.blockComment = { start: "/*", end: "*/" };
    Mode.prototype.getNextLineIndent = function (state, line, tab) {
      var indent = this.$getIndent(line);
      var tokens = this.getTokenizer().getLineTokens(line, state).tokens;
      if (tokens.length && tokens[tokens.length - 1].type === "comment")
        return indent;
      if (state === "start" && /^.*[({[]\s*$/.test(line)) indent += tab;
      return indent;
    };
    Mode.prototype.checkOutdent = function (_state, line, input) {
      return /^\s+$/.test(line) && /^\s*}/.test(input);
    };
    Mode.prototype.autoOutdent = function (_state, session, row) {
      var line = session.getLine(row);
      var match = line.match(/^(\s*})/);
      if (!match) return;
      var column = match[1].length;
      var openBrace = session.findMatchingBracket({ row: row, column: column });
      if (!openBrace || openBrace.row === row) return;
      var indent = this.$getIndent(session.getLine(openBrace.row));
      session.replace(new Range(row, 0, row, column - 1), indent);
    };
    exports.Mode = Mode;
  }
);
