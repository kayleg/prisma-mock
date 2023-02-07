"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let ciud_cache = 0;
function pad(s, size) {
    while (s.length < (size || 2)) {
        s = "0" + s;
    }
    return s;
}
// Format from: https://cuid.marcoonroad.dev/
const Cuid = () => {
    ciud_cache++;
    return `c00p6qup2${pad(String(ciud_cache), 4)}ckkzslahp5p`;
};
exports.default = Cuid;
