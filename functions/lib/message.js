"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const luxon = require("luxon");
class Message {
    static hi() {
        const time = luxon.DateTime.local();
        return `👋 어서오세요. ${time.setLocale('ko-kr').setZone('Asia/Seoul').toLocaleString(luxon.DateTime.DATETIME_SHORT)}`;
    }
    static bye() {
        const time = luxon.DateTime.local();
        return `👍 수고하셨습니다. ${time.setLocale('ko-kr').setZone('Asia/Seoul').toLocaleString(luxon.DateTime.DATETIME_SHORT)}`;
    }
}
exports.Message = Message;
//# sourceMappingURL=message.js.map