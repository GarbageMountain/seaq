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
    return getMetaDataList(list, query, keys, fuzzy)
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
                var value = getProperty(item, key);
                if (typeof value === 'string') {
                    return value;
                }
                return;
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
function getProperty(obj, key) {
    var dotIndex = key.indexOf('.');
    // console.log(key);
    if (dotIndex >= 0) {
        var objKey = key.substring(0, dotIndex);
        // console.log(objKey);
        var childKey = key.substring(dotIndex + 1);
        // console.log(childKey);
        var newObj = obj[objKey];
        return getProperty(newObj, childKey);
    }
    return obj[key];
}
