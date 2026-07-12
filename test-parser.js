"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var deep_parser_1 = require("./src/lib/deep-parser");
var html = "\n<body>\n<h1>Introduction</h1>\n<p>Here is some text.</p>\n<p><img src=\"rf_fig_1.png\" alt=\"Test Image\" /></p>\n<p>Figure 1: This is a test image.</p>\n<p>CHARTIMGXchart_pending_1XEND</p>\n<p>Figure 2: This is a chart.</p>\n</body>\n";
var doc = deep_parser_1.DocumentParser.parseHtml(html);
console.log(JSON.stringify(doc.body.filter(function (n) { return n.type === 'figure' || n.type === 'image'; }), null, 2));
