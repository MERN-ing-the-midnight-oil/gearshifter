"use strict";
// Thermal printer hardware module exports
// Provides printer service, hooks, and utilities for Phomemo M110 and other ESC/POS printers
Object.defineProperty(exports, "__esModule", { value: true });
exports.printItemTags = exports.printItemTag = exports.usePrinter = exports.printerService = void 0;
var printer_1 = require("./printer");
Object.defineProperty(exports, "printerService", { enumerable: true, get: function () { return printer_1.printerService; } });
var usePrinter_1 = require("./usePrinter");
Object.defineProperty(exports, "usePrinter", { enumerable: true, get: function () { return usePrinter_1.usePrinter; } });
var tagPrinter_1 = require("./tagPrinter");
Object.defineProperty(exports, "printItemTag", { enumerable: true, get: function () { return tagPrinter_1.printItemTag; } });
Object.defineProperty(exports, "printItemTags", { enumerable: true, get: function () { return tagPrinter_1.printItemTags; } });
