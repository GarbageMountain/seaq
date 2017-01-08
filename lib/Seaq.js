"use strict";
/**
 * Seaq is a Fuzzy searching utility function.
 * Given an input Array<T>, a set of object keys to search, and a search
 * query, Seaq will return a new Array<T> containing the results ordered by
 * their Score which is calculated using a variation of string_score algorithm.
 */
var Scorer_1 = require("./Scorer");
function seaq(list, query, keys, fuzzy) {
    // const cache: { [id: string]: number } = {};
    var metaDataList = getMetaDataList(list, query, keys, fuzzy);
    var sortedList = getSortedList(metaDataList);
    var rawList = sortedList.map(function (item) {
        return item.item;
    });
    return rawList;
}
exports.seaq = seaq;
function getMetaDataList(list, query, keys, fuzzy) {
    var fullList = list.map(function (item) {
        // const keyScores = keys.map(key => {
        //   const value = getProperty(item, key);
        //   let score = 0;
        //   if (typeof value === 'string') {
        //     score = string_score(value, query, fuzzy);
        //   }
        //   return {
        //     key: key,
        //     score: score,
        //   }
        // });
        var keyValues = keys.map(function (key) {
            var value = getProperty(item, key);
            if (typeof value === 'string') {
                return value;
            }
            return;
        });
        var allKeys = keyValues.join(' ');
        var score = Scorer_1.string_score(allKeys, query, fuzzy);
        return {
            item: item,
            // scores: keyScores,
            score: score,
        };
    });
    return fullList.filter(function (item) { return item.score > 0; });
}
function getSortedList(list) {
    return list.sort(function (a, b) {
        if (a.score > b.score) {
            return -1;
        }
        if (a.score < b.score) {
            return 1;
        }
        return 0;
    });
}
exports.getSortedList = getSortedList;
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
exports.getProperty = getProperty;
