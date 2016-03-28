﻿var api = require('./api.js');
var Q = require('q');
var fs = require('fs');

var debug = true;
var slient = false;

var targetUrl= 'http://bangumi.tv/anime/browser';
var host = 'http://bangumi.tv';

var dataFile = 'data.tmp';
api.getHtml(targetUrl).then(
	function(result) { return gettotalPage(result);},
	function(error) { console.log(error);}
).then(
	function(totalPage) {return praseAll(1,totalPage);},
	function(error) {console.log(error);}
).then(
	function() { 
		if(!slient) {
			console.log("done"); 
		}
	},
	function(error) { console.log(error);}
);
	

function gettotalPage(html) {
	var deferred = Q.defer();
	
	var location = /(<span class="p_edge">)(.*)(<\/span>)/;
	var result = html.match(location)[2];
	if(debug) {
		console.log('==== [gettotalPage] location result ====');
		console.log(result);
		console.log('===================================');
	}
	
	var totalPageString = result.split('/')[1].replace(/&nbsp;/g,'').replace(')','');
	
	var totalPage = parseInt(totalPageString);
	if(totalPage == NaN || totalPage <= 0) {
		deferred.reject('[gettotalPage] problem with totalPage: ' + totalPageString);
		return deferred.promise;	
	}
	
	if(!slient) {
		console.log('[gettotalPage] totalPage:' + totalPage);
	}
	
	deferred.resolve(totalPage);
	return deferred.promise;	
}

function prasePage(pageUrl) {
	var deferred = Q.defer();
	api.getHtml(pageUrl).then(
		function(html) {
			// var subjectRegEx = /\/subject\/\d+/g;
			var subjectRegEx = /(<a href=")(\/subject\/\d+)(" class="l">)(.*)(<\/a> <small class="grey">)(.*)(<\/small>)/g
			var result = html.match(subjectRegEx);
			if(debug) {
				console.log('====== [prasePage] subjects =======');
				console.log(result);
				console.log('===================================');
			}
			
			result = unique(result);			
			praseSubjectInPage(deferred,result,0,result.length);
		},function(error) {
			console.log(error);
		}
	);
	return deferred.promise;	
}

function praseSubject(subject) {
	var deferred = Q.defer();
	praseSubjectContent(subject).then(
		function() {
			praseSubjectCharacters(deferred,subject)
		},
		function(error) { console.log(error) }
	);
	return deferred.promise;
}

function praseSubjectContent(subject) {
	var deferred = Q.defer();
	
	if(debug) {
		console.log('[praseSubject] subject:' + subject);
	}
	
	var subjectRegEx = /<a href="(\/subject\/\d+)" class="l">.*<\/a> <small class="grey">(.*)<\/small>/;
	var result = subject.match(subjectRegEx);
	if(debug) {
		console.log('==== [praseSubject] subject split result ====');
		console.log(result);
		console.log('=============================================');
	}
	
	var urlpath = result[1];
	var homename = result[2];
	var subjectUrl = host + urlpath;
	if(debug) {
		console.log('[praseSubject] subjectUrl:' + urlpath);
	}
	
	api.getHtml(subjectUrl).then(
		function(html) {
			parseHtml(deferred,html,homename,'');
		},function(error) {
			console.log(error);
		}
	);
	return deferred.promise;	
}

function praseSubjectCharacters(deferred,subject) {
	if(debug) {
		console.log('[praseSubjectCharacters] subject:' + subject);
	}
	
	var subjectRegEx = /<a href="(\/subject\/\d+)" class="l">.*<\/a> <small class="grey">(.*)<\/small>/;
	var result = subject.match(subjectRegEx);
	if(debug) {
		console.log('==== [praseSubjectCharacters] subject split result ====');
		console.log(result);
		console.log('=======================================================');
	}
	
	var urlpath = result[1];
	var parent = result[2];
	var subjectCharactersUrl = host + urlpath + '/characters';
	if(debug) {
		console.log('[praseSubjectCharacters] subjectCharactersUrl:' + urlpath);
	}	
	api.getHtml(subjectCharactersUrl).then(
		function(html) {
			var characterRegEx = /<a href="(\/character\/\d+)" class="l">.*<\/a>/g
			var result = html.match(characterRegEx);
			if(debug) {
				console.log('==== [praseSubjectCharacters] get characters ====');
				console.log(result);
				console.log('=======================================================');	
			}
			
			// 该条目没有角色信息
			if(result === null) {
				deferred.resolve();
				return;
			}
			praseSubjectCharacterInSubject(deferred,result,0,result.length,parent);
		},function(error) {
			console.log(error);
		}
	);
	
}

function praseCharacter(character,parent) {
	var deferred = Q.defer();
	if(debug) {
		console.log('[praseCharacter] character:' + character);
	}
	
	var characterRegEx = /<a href="(\/character\/\d+)" class="l">(.*)<\/a>/;
	var result = character.match(characterRegEx);
	if(debug) {
		console.log('==== [praseCharacter] character split result ====');
		console.log(result);
		console.log('=======================================================');
	}
	
	var urlpath = result[1];
	var homename = result[2];
	
	var characterUrl = host + urlpath;
	if(debug) {
		console.log('[praseCharacter] characterUrl:' + urlpath);
	}	
	api.getHtml(characterUrl).then(
		function(html) {
			parseHtml(deferred,html,homename,parent);
		},function(error) {
			console.log(error);
		}
	);
	return deferred.promise;	
}

function parseHtml(deferred,html,homename,parent) {
	var otherName = /((中文名|简体中文名|别名): <\/span>)(.*)(<\/li>)/g;
	var result = html.match(otherName);
	if(debug) {
		console.log('==== [parseHtml] otherName =====');
		console.log(result);
		console.log('===================================');
	}
	
	var otherSplit = /((中文名|简体中文名|别名): <\/span>)(.*)(<\/li>)/;
	
	var content = parent;
	var content = content + ' @*';
	var content = content + homename;
	var content = content + ' @*';
	for(i in result) {
		content = content + result[i].match(otherSplit)[3].replace(/'/g,'').replace(',','');
		content = content + '@*';
	}
	if(!slient) {
		console.log('[parseHtml] content:' + content);
	}
	fs.appendFileSync(dataFile, content + "\n");
	deferred.resolve();
}



function praseAll(page,total) {
	var deferred = Q.defer();
	if(page > total) { // done
		deferred.resolve();
		return;
	}
	
	if(debug) {
		console.log('[praseAll] page:' + page);
	}
	
	var pageUrl = targetUrl + '?page=' + page;
	
	if(debug) {
		console.log('[praseAll] pageUrl:' + pageUrl);
	}
	
	prasePage(pageUrl).then (
		function() {
			//praseAll(++page,total);
		},function() {
			console.log(error);
		}
	);
	return deferred.promise;	
}

function praseSubjectInPage(deferred,result,pos,total) {
	if(pos >= total) {	// prase page done
		deferred.resolve();
		return;
	}
	
	praseSubject(result[pos]).then(
		function() { 
			praseSubjectInPage(deferred,result,++ pos,total);
		},
		function(error) {console.log(error);}
	);
}

function praseSubjectCharacterInSubject(deferred,result,pos,total,parent) {
	if(debug) {
		console.log('[praseSubjectCharacterInSubject] pos:' + pos + ' total:' + total);
	}
	
	if(pos >= total) {	// parse Subject done
		deferred.resolve();
		return;
	}
	
	
	praseCharacter(result[pos],parent).then(
		function() {
			praseSubjectCharacterInSubject(deferred,result,++ pos,total);
		},
		function(error) {console.log(error);}
	);
}

function unique(arr) {
    var result = [], hash = {};
    for (var i = 0, elem; (elem = arr[i]) != null; i++) {
        if (!hash[elem]) {
            result.push(elem);
            hash[elem] = true;
        }
    }
    return result;
//http://www.cnblogs.com/sosoft/
}