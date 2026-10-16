enum S { A = "a", B = "b" }
enum N { X, Y = 5 }
const sv = Object.values(S);
if (sv.length !== 2 || sv[0] !== "a" || sv[1] !== "b") throw new Error("values string enum");
if (Object.keys(S).join() !== "A,B") throw new Error("keys string enum");
const nk = Object.keys(N).sort().join();
if (nk !== "0,5,X,Y") throw new Error("keys numeric enum: " + nk);
const alias = N;
if (alias.Y !== 5 || alias[5] !== "Y") throw new Error("alias");
function take(e: Record<string, string | number>) { return Object.entries(e).length; }
if (take(S) !== 2) throw new Error("passed as argument");
console.log("enum as value ok");
