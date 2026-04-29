async function foo() {
    return 42
}

const result = foo()
console.log(result)  // Promise { 42 }, а НЕ 42!

result.then(value => console.log(value))  // 42