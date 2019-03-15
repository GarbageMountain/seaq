"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Seaq is a Fuzzy searching utility function.
 * Given an input Array<T>, a set of object keys to search, and a search
 * query, Seaq will return a new Array<T> containing the results ordered by
 * their Score which is calculated using a variation of string_score algorithm.
 */
var Scorer_1 = require("./Scorer");
function seaq(list, query, keys, fuzzy) {
    var l = getMetaDataList(list, query, keys, fuzzy);
    return l
        .sort(function (a, b) { return b.score - a.score; })
        .map(function (item) { return item.item; });
}
exports.seaq = seaq;
function getMetaDataList(list, query, keys, fuzzy) {
    // get a list of all items whose score is > 0
    var fullList = list.map(function (item) {
        // get a string representation of all keys joined with ' ' or if no keys, the item stringified
        var searchString = keys
            ? keys
                .map(function (key) {
                if (typeof key === 'string') {
                    var value = getProperty(item, key).join(' ');
                    return value;
                }
            })
                .join(' ')
            : item.toString();
        // calculate match score
        var score = Scorer_1.string_score(searchString, query, fuzzy);
        // return original item and its matching score
        return {
            item: item,
            score: score
        };
    });
    // return only those items whose score is > 0
    return fullList.filter(function (item) { return item.score > 0; });
}
function getProperty(obj, path, list) {
    if (list === void 0) { list = []; }
    if (!path) {
        // If there's no path left, we've gotten to the object we care about.
        list.push(obj.toString());
    }
    else {
        var dotIndex = path.indexOf('.');
        var firstSegment = path;
        var remaining = null;
        if (dotIndex !== -1) {
            firstSegment = path.slice(0, dotIndex);
            remaining = path.slice(dotIndex + 1);
        }
        var value = obj[firstSegment];
        if (value !== null && value !== undefined) {
            if (!remaining && (typeof value === 'string' || typeof value === 'number')) {
                list.push(value.toString());
            }
            else if (Array.isArray(value)) {
                // Search each item in the array.
                for (var i = 0, len = value.length; i < len; i += 1) {
                    getProperty(value[i], remaining, list);
                }
            }
            else if (remaining) {
                // An object. Recurse further.
                getProperty(value, remaining, list);
            }
        }
    }
    return list;
}
