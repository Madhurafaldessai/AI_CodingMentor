import type { Language } from './types';
export const referenceSolutions:Record<string,Record<Language,string>>={
 'reverse-string':{python:'text = input().strip()\nprint(text[::-1])',javascript:'const text = require("fs").readFileSync(0, "utf8").trim();\nconsole.log(text.split("").reverse().join(""));',cpp:'#include <iostream>\n#include <string>\n#include <algorithm>\nusing namespace std;\nint main() { string text; cin >> text; reverse(text.begin(), text.end()); cout << text; }'},
 'sum-two-numbers':{python:'a, b = map(int, input().split())\nprint(a + b)',javascript:'const [a,b] = require("fs").readFileSync(0,"utf8").trim().split(/\\s+/).map(Number);\nconsole.log(a+b);',cpp:'#include <iostream>\nusing namespace std; int main(){int a,b;cin>>a>>b;cout<<a+b;}'},
};
