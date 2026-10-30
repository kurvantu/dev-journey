import { PYTHON_LESSONS } from "./python-lessons";

/**
 * The curriculum is organised around UNIVERSAL CONCEPTS.
 * Every language implements the same concept keys so a learner can jump
 * sideways ("how does Go do what I just did in Rust?") – this is the core of
 * the polyglot learning strategy.
 */

export type ConceptKey =
  | "hello"
  | "variables"
  | "control"
  | "functions"
  | "collections"
  | "structs"
  | "errors"
  | "memory"
  | "concurrency"
  | "web"
  | "tensors"
  | "llm";

export const CONCEPTS: Record<ConceptKey, { title: string; icon: string; blurb: string }> = {
  hello: { title: "Entry point & output", icon: "🚀", blurb: "Where does execution start and how do I print?" },
  variables: { title: "Variables & types", icon: "🧱", blurb: "How do I name data, and how strict is the type system?" },
  control: { title: "Control flow", icon: "🔀", blurb: "Loops, branches and pattern matching." },
  functions: { title: "Functions", icon: "ƒ", blurb: "Reusable logic, parameters, return values, first-class functions." },
  collections: { title: "Collections", icon: "📚", blurb: "Lists, maps and iterating / transforming them." },
  structs: { title: "Data modelling", icon: "🏗️", blurb: "Structs, classes, methods: grouping data with behaviour." },
  errors: { title: "Error handling", icon: "🧯", blurb: "Return codes, Result types, or exceptions?" },
  memory: { title: "Memory model", icon: "🧠", blurb: "Who owns memory and who frees it?" },
  concurrency: { title: "Concurrency", icon: "🧵", blurb: "Threads, goroutines, the event loop." },
  web: { title: "Web / I/O", icon: "🌐", blurb: "The first step toward any web framework." },
  tensors: { title: "Matrices & tensors", icon: "🔢", blurb: "The data structure all of machine learning runs on." },
  llm: { title: "Neural nets & LLMs", icon: "🧬", blurb: "Embeddings, attention, backprop – a language model from scratch." },
};

export interface TrackSeed {
  id: string;
  name: string;
  tagline: string;
  color: string;
  paradigm: string;
  mentalModel: string;
  frameworks: string[];
  sortOrder: number;
}

export interface LessonSeed {
  slug: string;
  title: string;
  concept: ConceptKey;
  explanation: string;
  starterCode: string;
  expectedOutput: string | null;
  hint: string;
  transfer: string;
}

export const TRACKS: TrackSeed[] = [
  {
    id: "c",
    name: "C",
    tagline: "The language the machine actually speaks.",
    color: "#60a5fa",
    paradigm: "Procedural, manual memory",
    mentalModel:
      "You are the operating system's guest. Every byte is yours to allocate and free. Learn C to understand what every other language is hiding from you.",
    frameworks: ["POSIX", "libcurl", "SQLite", "Raylib", "CMake / Make"],
    sortOrder: 1,
  },
  {
    id: "rust",
    name: "Rust",
    tagline: "Memory safety without a garbage collector.",
    color: "#fb923c",
    paradigm: "Multi-paradigm, ownership-based",
    mentalModel:
      "The compiler is a strict but fair reviewer. Ownership and borrowing replace both malloc/free and the GC. Fight the borrow checker once, then it protects you forever.",
    frameworks: ["Cargo", "Tokio", "Axum", "Actix Web", "Serde", "SQLx"],
    sortOrder: 2,
  },
  {
    id: "go",
    name: "Go",
    tagline: "Simplicity and concurrency for teams.",
    color: "#22d3ee",
    paradigm: "Procedural, garbage collected, CSP concurrency",
    mentalModel:
      "There is usually one obvious way to do it. Errors are values, goroutines are cheap, and the standard library already has an HTTP server.",
    frameworks: ["net/http", "Gin", "Echo", "Fiber", "gRPC", "GORM"],
    sortOrder: 3,
  },
  {
    id: "php",
    name: "PHP",
    tagline: "The request/response language of the web.",
    color: "#a78bfa",
    paradigm: "Scripting, object-oriented, request-scoped",
    mentalModel:
      "Each HTTP request is a fresh world: the script starts, renders, and dies. Modern PHP (8+) is typed, fast and has world-class frameworks.",
    frameworks: ["Composer", "Laravel", "Symfony", "PDO", "PHPUnit", "Livewire"],
    sortOrder: 4,
  },
  {
    id: "python",
    name: "Python",
    tagline: "Readable code, and the native tongue of AI.",
    color: "#facc15",
    paradigm: "Dynamic, multi-paradigm, batteries included",
    mentalModel:
      "Optimised for the reader, not the machine. Indentation IS the syntax. Python is slow at loops and fast at libraries - which is why every ML framework is a C/CUDA engine wearing a Python coat.",
    frameworks: ["pip / venv", "NumPy", "PyTorch", "FastAPI", "Django", "pandas"],
    sortOrder: 6,
  },
  {
    id: "node",
    name: "Node.js",
    tagline: "JavaScript everywhere, one event loop.",
    color: "#4ade80",
    paradigm: "Event-driven, asynchronous, dynamically typed",
    mentalModel:
      "A single thread that never waits. Everything slow (disk, network) is a callback, promise or async/await. Learn the event loop and the whole ecosystem clicks.",
    frameworks: ["npm", "Express", "Fastify", "NestJS", "Next.js", "Prisma"],
    sortOrder: 5,
  },
];

export const LESSONS: Record<string, LessonSeed[]> = {
  python: PYTHON_LESSONS,

  /* ───────────────────────────── C ───────────────────────────── */
  c: [
    {
      slug: "hello",
      title: "Hello, main()",
      concept: "hello",
      explanation:
        "Every C program begins in `main`. `printf` writes formatted text to stdout and `\\n` ends a line. The `return 0` is the exit code the operating system sees – 0 means success.",
      starterCode: `#include <stdio.h>

int main(void) {
    printf("Hello from C!\\n");
    printf("Every C program starts in main().\\n");
    return 0;
}
`,
      expectedOutput: "Hello from C!\nEvery C program starts in main().",
      hint: "Try changing the return value to 3 and look at the exit code in the output panel.",
      transfer:
        "Rust and Go also have an explicit `main`. PHP and Node simply execute the file top to bottom – the file itself is the entry point.",
    },
    {
      slug: "variables",
      title: "Variables & primitive types",
      concept: "variables",
      explanation:
        "C is statically typed: you declare the type and it never changes. `int`, `double`, `char` are fixed-size boxes. `sizeof` tells you exactly how many bytes a type occupies – nothing is hidden.",
      starterCode: `#include <stdio.h>

int main(void) {
    int age = 42;
    double pi = 3.14159;
    char grade = 'A';
    const char *name = "Ada";

    printf("name=%s age=%d\\n", name, age);
    printf("pi=%.2f grade=%c\\n", pi, grade);
    printf("sizeof(int)=%zu bytes\\n", sizeof(int));
    return 0;
}
`,
      expectedOutput: "name=Ada age=42\npi=3.14 grade=A\nsizeof(int)=4 bytes",
      hint: "Print sizeof(double) and sizeof(char). Why is a string a `char *`?",
      transfer:
        "Rust and Go infer types but are still static. PHP and JavaScript are dynamic: the *value* has a type, the variable does not.",
    },
    {
      slug: "control-flow",
      title: "Loops & branches",
      concept: "control",
      explanation:
        "`for`, `while` and `if/else` look almost identical in every C-family language – that is why learning them once in C pays off everywhere. Note `%` is the remainder operator.",
      starterCode: `#include <stdio.h>

int main(void) {
    for (int i = 1; i <= 5; i++) {
        if (i % 2 == 0) {
            printf("%d is even\\n", i);
        } else {
            printf("%d is odd\\n", i);
        }
    }
    int n = 3;
    while (n > 0) {
        printf("countdown %d\\n", n);
        n--;
    }
    return 0;
}
`,
      expectedOutput: "1 is odd\n2 is even\n3 is odd\n4 is even\n5 is odd\ncountdown 3\ncountdown 2\ncountdown 1",
      hint: "Rewrite the while loop as a do/while. Add a switch statement on n.",
      transfer: "Go drops the parentheses and only has `for`. Rust adds powerful `match`. JS and PHP are nearly identical to C.",
    },
    {
      slug: "functions",
      title: "Functions & prototypes",
      concept: "functions",
      explanation:
        "A C function must be declared before use – that is why they appear above `main`. Parameters are passed **by value** (copied); to let a function change your data you pass a pointer.",
      starterCode: `#include <stdio.h>

int square(int x) {
    return x * x;
}

void greet(const char *who) {
    printf("Hi, %s\\n", who);
}

int main(void) {
    greet("learner");
    printf("square(7) = %d\\n", square(7));
    return 0;
}
`,
      expectedOutput: "Hi, learner\nsquare(7) = 49",
      hint: "Write `void increment(int *n)` that adds 1 through a pointer, and call it with &value.",
      transfer:
        "Rust, Go and PHP all have typed parameters too. In JS and PHP functions are first-class values you can pass around freely; in C you use function pointers.",
    },
    {
      slug: "arrays",
      title: "Arrays – contiguous memory",
      concept: "collections",
      explanation:
        "A C array is just a block of memory. It does not know its own length, so we compute it with `sizeof`. Casting to `double` before dividing avoids integer division.",
      starterCode: `#include <stdio.h>

int main(void) {
    int scores[] = {90, 72, 85, 60};
    int count = sizeof(scores) / sizeof(scores[0]);
    int total = 0;

    for (int i = 0; i < count; i++) {
        total += scores[i];
    }
    printf("count=%d total=%d avg=%.2f\\n", count, total, (double)total / count);
    return 0;
}
`,
      expectedOutput: "count=4 total=307 avg=76.75",
      hint: "Find the maximum score. What happens if you read scores[10]? (Undefined behaviour – the big C danger.)",
      transfer:
        "Every other language gives you growable lists (Vec, slice, array, Array) that know their length and check bounds. C teaches you what they cost.",
    },
    {
      slug: "structs",
      title: "Structs & pointers",
      concept: "structs",
      explanation:
        "A `struct` groups fields together. There are no methods, so you write functions that take a pointer to the struct. `p->x` is shorthand for `(*p).x`.",
      starterCode: `#include <stdio.h>

typedef struct {
    const char *name;
    int x;
    int y;
} Point;

void move_by(Point *p, int dx, int dy) {
    p->x += dx;
    p->y += dy;
}

int main(void) {
    Point p = {"origin", 0, 0};
    move_by(&p, 3, 4);
    printf("%s moved to (%d, %d)\\n", p.name, p.x, p.y);
    return 0;
}
`,
      expectedOutput: "origin moved to (3, 4)",
      hint: "Add a `double distance(Point a, Point b)` function using sqrt from <math.h>.",
      transfer:
        "Rust's `impl Point { fn move_by(&mut self) }` and Go's `func (p *Point) MoveBy()` are exactly this pattern with nicer syntax. PHP/JS use classes.",
    },
    {
      slug: "errors",
      title: "Errors as return codes",
      concept: "errors",
      explanation:
        "C has no exceptions. The convention is: return a status code and write results through an out-pointer. Forgetting to check the return value is the #1 C bug – a lesson Go and Rust took to heart.",
      starterCode: `#include <stdio.h>

/* C has no exceptions: functions return status codes. */
int divide(int a, int b, int *result) {
    if (b == 0) {
        return -1; /* error */
    }
    *result = a / b;
    return 0; /* success */
}

int main(void) {
    int value;
    if (divide(10, 2, &value) == 0) {
        printf("10 / 2 = %d\\n", value);
    }
    if (divide(1, 0, &value) != 0) {
        printf("error: division by zero\\n");
    }
    return 0;
}
`,
      expectedOutput: "10 / 2 = 5\nerror: division by zero",
      hint: "Use `errno` and `perror` after calling fopen on a file that doesn't exist.",
      transfer:
        "Go returns `(value, error)` – the same idea, made idiomatic. Rust wraps it in `Result<T, E>` so you *cannot* forget. PHP/JS throw exceptions.",
    },
    {
      slug: "memory",
      title: "malloc & free – manual memory",
      concept: "memory",
      explanation:
        "The heap is yours: `malloc` asks for bytes, `free` gives them back. Forget `free` and you leak; use after `free` and you crash. Understanding this makes Rust's ownership rules feel obvious.",
      starterCode: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(void) {
    char *buffer = malloc(32);
    if (buffer == NULL) return 1;

    strcpy(buffer, "heap memory");
    printf("%s (%zu chars)\\n", buffer, strlen(buffer));

    free(buffer); /* you own it, you free it */
    printf("freed. no garbage collector here.\\n");
    return 0;
}
`,
      expectedOutput: "heap memory (11 chars)\nfreed. no garbage collector here.",
      hint: "Allocate an int array of 1000 elements with calloc, fill it, then free it.",
      transfer:
        "Rust: the compiler inserts `free` for you at the end of scope. Go, PHP, Node: a garbage collector finds unused memory at runtime.",
    },
  ],

  /* ─────────────────────────── RUST ─────────────────────────── */
  rust: [
    {
      slug: "hello",
      title: "Hello, println!",
      concept: "hello",
      explanation:
        "`println!` is a macro (hence the `!`) that checks your format string at compile time. Rust programs also start in `fn main`, and the compiler refuses to build anything it cannot prove safe.",
      starterCode: `fn main() {
    println!("Hello from Rust!");
    println!("The compiler is your pair programmer.");
}
`,
      expectedOutput: "Hello from Rust!\nThe compiler is your pair programmer.",
      hint: "Try println!(\"{}\") with no argument and read the compile error carefully – Rust errors are tutorials.",
      transfer: "Same shape as C's main. Unlike C, format-string mistakes are caught before the program runs.",
    },
    {
      slug: "variables",
      title: "Immutable by default",
      concept: "variables",
      explanation:
        "`let` creates an immutable binding; you must write `let mut` to allow changes. Types are inferred but still static – `pi: f64` is an explicit annotation.",
      starterCode: `fn main() {
    let name = "Ada";          // immutable by default
    let mut counter = 0;       // opt in to mutation
    counter += 1;
    let pi: f64 = 3.14159;
    let is_safe = true;

    println!("name={} counter={}", name, counter);
    println!("pi={:.2} is_safe={}", pi, is_safe);
}
`,
      expectedOutput: "name=Ada counter=1\npi=3.14 is_safe=true",
      hint: "Remove `mut` and try to compile. Then shadow a variable: `let counter = counter * 2;`.",
      transfer:
        "JS `const` and PHP have no true immutability for objects; Rust's is deep. Go uses `:=` to infer like Rust's `let`.",
    },
    {
      slug: "control-flow",
      title: "Loops & match",
      concept: "control",
      explanation:
        "`for i in 1..=5` iterates an inclusive range. `match` is a supercharged switch: it is an expression that returns a value and the compiler forces you to handle every case (`_`).",
      starterCode: `fn main() {
    for i in 1..=5 {
        if i % 2 == 0 {
            println!("{} is even", i);
        } else {
            println!("{} is odd", i);
        }
    }
    let code = 404;
    let label = match code {
        200 => "ok",
        404 => "not found",
        _ => "unknown",
    };
    println!("{} -> {}", code, label);
}
`,
      expectedOutput: "1 is odd\n2 is even\n3 is odd\n4 is even\n5 is odd\n404 -> not found",
      hint: "Remove the `_` arm and read the error. Try `if let` and `while let` with an Option.",
      transfer: "PHP 8 has a `match` expression inspired by Rust. Go's `switch` and JS `switch` are statements, not expressions.",
    },
    {
      slug: "functions",
      title: "Expressions return values",
      concept: "functions",
      explanation:
        "The last expression in a block (no semicolon) is its value – so `x * x` returns. `&str` is a borrowed string slice: the function reads it without taking ownership.",
      starterCode: `fn square(x: i32) -> i32 {
    x * x // last expression is the return value
}

fn greet(who: &str) {
    println!("Hi, {}", who);
}

fn main() {
    greet("learner");
    println!("square(7) = {}", square(7));
}
`,
      expectedOutput: "Hi, learner\nsquare(7) = 49",
      hint: "Write a closure `let add = |a, b| a + b;` and pass it to a function taking `impl Fn(i32, i32) -> i32`.",
      transfer: "Closures in Rust ≈ arrow functions in JS ≈ `fn()` in PHP. C needs function pointers.",
    },
    {
      slug: "collections",
      title: "Vec & iterators",
      concept: "collections",
      explanation:
        "`Vec<T>` is a growable array that knows its length. Iterator chains (`iter().filter().collect()`) are zero-cost: they compile down to the same loop you would write in C.",
      starterCode: `fn main() {
    let scores = vec![90, 72, 85, 60];
    let total: i32 = scores.iter().sum();
    let avg = total as f64 / scores.len() as f64;
    let passing: Vec<&i32> = scores.iter().filter(|s| **s >= 70).collect();

    println!("count={} total={} avg={:.2}", scores.len(), total, avg);
    println!("passing={:?}", passing);
}
`,
      expectedOutput: "count=4 total=307 avg=76.75\npassing=[90, 72, 85]",
      hint: "Use a HashMap<String, i32> to count word frequencies. Try `.map()` and `.max()`.",
      transfer: "JS `filter/map/reduce`, PHP `array_filter/array_map`, Go `for range` loops – same ideas, different ergonomics.",
    },
    {
      slug: "structs",
      title: "Structs & impl blocks",
      concept: "structs",
      explanation:
        "Data (`struct`) and behaviour (`impl`) are separate. `&mut self` says 'this method mutates the instance' – the caller must own a `mut` binding, so mutation is always visible in the code.",
      starterCode: `struct Point {
    name: String,
    x: i32,
    y: i32,
}

impl Point {
    fn move_by(&mut self, dx: i32, dy: i32) {
        self.x += dx;
        self.y += dy;
    }
}

fn main() {
    let mut p = Point { name: String::from("origin"), x: 0, y: 0 };
    p.move_by(3, 4);
    println!("{} moved to ({}, {})", p.name, p.x, p.y);
}
`,
      expectedOutput: "origin moved to (3, 4)",
      hint: "Add `#[derive(Debug)]` and print with {:?}. Define a trait `Shape` with `fn area(&self) -> f64`.",
      transfer: "Traits ≈ Go interfaces ≈ PHP interfaces. Go's pointer receivers (*Point) are Rust's &mut self.",
    },
    {
      slug: "errors",
      title: "Result<T, E> – errors you can't ignore",
      concept: "errors",
      explanation:
        "A function that can fail returns `Result`. The caller must `match` (or use `?` to propagate). The compiler will not let you silently drop an error – the C bug class is gone.",
      starterCode: `fn divide(a: i32, b: i32) -> Result<i32, String> {
    if b == 0 {
        return Err(String::from("division by zero"));
    }
    Ok(a / b)
}

fn main() {
    match divide(10, 2) {
        Ok(v) => println!("10 / 2 = {}", v),
        Err(e) => println!("error: {}", e),
    }
    match divide(1, 0) {
        Ok(v) => println!("1 / 0 = {}", v),
        Err(e) => println!("error: {}", e),
    }
}
`,
      expectedOutput: "10 / 2 = 5\nerror: division by zero",
      hint: "Write `fn run() -> Result<(), String>` and use the `?` operator inside it. Try Option<T> for 'maybe missing' values.",
      transfer: "Go's `(value, err)` is the same idea without compiler enforcement. JS/PHP exceptions are invisible in the signature.",
    },
    {
      slug: "ownership",
      title: "Ownership & borrowing",
      concept: "memory",
      explanation:
        "Each value has exactly one owner. Assigning moves ownership; `&` borrows temporarily. When the owner goes out of scope the memory is freed – automatically, deterministically, with no GC.",
      starterCode: `fn shout(s: &String) -> String {
    s.to_uppercase()
}

fn main() {
    let owner = String::from("ownership");
    let borrowed = &owner;          // borrow, don't move
    println!("{} / {}", owner, shout(borrowed));

    let moved = owner;              // ownership moves here
    println!("{} now lives in \`moved\`", moved);
    // println!("{}", owner);       // compile error: value moved
    println!("no GC, no manual free: the compiler proves safety.");
}
`,
      expectedOutput: "ownership / OWNERSHIP\nownership now lives in `moved`\nno GC, no manual free: the compiler proves safety.",
      hint: "Uncomment the last println! and read the error E0382. Then fix it with `.clone()`.",
      transfer: "This replaces C's malloc/free. Go, PHP and Node use a garbage collector instead – simpler, but with runtime cost.",
    },
    {
      slug: "threads",
      title: "Fearless concurrency",
      concept: "concurrency",
      explanation:
        "`thread::spawn` starts an OS thread; `move` transfers ownership of captured variables into it. Because of ownership rules, data races are compile errors rather than 3am production incidents.",
      starterCode: `use std::thread;

fn main() {
    let handles: Vec<_> = (1..=3)
        .map(|i| thread::spawn(move || i * 10))
        .collect();

    let results: Vec<i32> = handles
        .into_iter()
        .map(|h| h.join().unwrap())
        .collect();

    println!("results={:?}", results);
}
`,
      expectedOutput: "results=[10, 20, 30]",
      hint: "Share a counter between threads with Arc<Mutex<i32>>. Then look up Tokio for async/await.",
      transfer: "Go's goroutines are lighter than threads. Node has one thread and an event loop. C uses pthreads with no safety net.",
    },
  ],

  /* ──────────────────────────── GO ──────────────────────────── */
  go: [
    {
      slug: "hello",
      title: "Hello, package main",
      concept: "hello",
      explanation:
        "A Go executable lives in `package main` and starts in `func main`. Imports are explicit and unused imports are compile errors – Go keeps code tidy by force.",
      starterCode: `package main

import "fmt"

func main() {
	fmt.Println("Hello from Go!")
	fmt.Println("Simple, fast, built for teams.")
}
`,
      expectedOutput: "Hello from Go!\nSimple, fast, built for teams.",
      hint: "Import \"os\" without using it and watch the compiler complain. Then use os.Exit(2).",
      transfer: "Like C and Rust there is an explicit main; like Rust the toolchain (go build, go fmt, go test) is batteries-included.",
    },
    {
      slug: "variables",
      title: "Short declarations",
      concept: "variables",
      explanation:
        "`var x int = 42` is the long form; `name := \"Ada\"` infers the type. Once set, a variable's type never changes. `%T` prints the type – handy for learning.",
      starterCode: `package main

import "fmt"

func main() {
	var age int = 42
	name := "Ada" // short declaration infers the type
	pi := 3.14159
	const language = "Go"

	fmt.Printf("name=%s age=%d\\n", name, age)
	fmt.Printf("pi=%.2f language=%s\\n", pi, language)
	fmt.Printf("type of pi: %T\\n", pi)
}
`,
      expectedOutput: "name=Ada age=42\npi=3.14 language=Go\ntype of pi: float64",
      hint: "Declare a variable and don't use it – Go refuses to compile. Try `var ready bool` and print its zero value.",
      transfer: "Go's zero values (0, \"\", false, nil) remove a whole class of C 'uninitialised variable' bugs.",
    },
    {
      slug: "control-flow",
      title: "One loop to rule them all",
      concept: "control",
      explanation:
        "Go has only `for` – it covers while loops and infinite loops too. `switch` doesn't fall through by default, so no `break` is needed. No parentheses around conditions.",
      starterCode: `package main

import "fmt"

func main() {
	for i := 1; i <= 5; i++ {
		if i%2 == 0 {
			fmt.Println(i, "is even")
		} else {
			fmt.Println(i, "is odd")
		}
	}
	code := 404
	switch code {
	case 200:
		fmt.Println("ok")
	case 404:
		fmt.Println("not found")
	default:
		fmt.Println("unknown")
	}
}
`,
      expectedOutput: "1 is odd\n2 is even\n3 is odd\n4 is even\n5 is odd\nnot found",
      hint: "Write a while-style loop: `for n > 0 { ... }`. Try a switch with no condition: `switch { case x > 5: ... }`.",
      transfer: "C/JS/PHP switch fall through unless you `break`. Rust's match is an expression. Go chose simplicity.",
    },
    {
      slug: "functions",
      title: "Multiple return values",
      concept: "functions",
      explanation:
        "Go functions can return several values – this is how errors are returned too. Parameters sharing a type can be grouped: `a, b int`.",
      starterCode: `package main

import "fmt"

func square(x int) int {
	return x * x
}

func divmod(a, b int) (int, int) { // multiple return values
	return a / b, a % b
}

func main() {
	fmt.Println("square(7) =", square(7))
	q, r := divmod(17, 5)
	fmt.Println("17 / 5 =", q, "remainder", r)
}
`,
      expectedOutput: "square(7) = 49\n17 / 5 = 3 remainder 2",
      hint: "Write a variadic function `sum(nums ...int) int`. Pass a function as a parameter: `func apply(f func(int) int, v int)`.",
      transfer: "Rust returns tuples `(i32, i32)`; JS/PHP return arrays or objects; C uses out-pointers.",
    },
    {
      slug: "slices-maps",
      title: "Slices & maps",
      concept: "collections",
      explanation:
        "A slice is a window over an array that can grow with `append`. A map is a hash table. `for _, v := range xs` is the idiomatic iteration – the `_` discards the index.",
      starterCode: `package main

import "fmt"

func main() {
	scores := []int{90, 72, 85, 60} // slice
	total := 0
	for _, s := range scores {
		total += s
	}
	fmt.Printf("count=%d total=%d avg=%.2f\\n", len(scores), total, float64(total)/float64(len(scores)))

	ages := map[string]int{"Ada": 36, "Linus": 54} // map
	ages["Grace"] = 85
	fmt.Println("Grace is", ages["Grace"], "- entries:", len(ages))
}
`,
      expectedOutput: "count=4 total=307 avg=76.75\nGrace is 85 - entries: 3",
      hint: "Use `v, ok := ages[\"Nobody\"]` to test presence. Append 5 items to a nil slice and print len/cap each time.",
      transfer: "Slice ≈ Rust Vec ≈ JS Array ≈ PHP list. Map ≈ HashMap ≈ JS Map/object ≈ PHP associative array.",
    },
    {
      slug: "structs",
      title: "Structs & methods",
      concept: "structs",
      explanation:
        "Methods are functions with a *receiver*. A pointer receiver `(p *Point)` lets the method modify the struct. Capitalised names are exported (public); lowercase are package-private.",
      starterCode: `package main

import "fmt"

type Point struct {
	Name string
	X, Y int
}

func (p *Point) MoveBy(dx, dy int) {
	p.X += dx
	p.Y += dy
}

func main() {
	p := Point{Name: "origin"}
	p.MoveBy(3, 4)
	fmt.Printf("%s moved to (%d, %d)\\n", p.Name, p.X, p.Y)
}
`,
      expectedOutput: "origin moved to (3, 4)",
      hint: "Define `type Shape interface { Area() float64 }` and implement it for two structs – no `implements` keyword needed.",
      transfer: "Go interfaces are satisfied implicitly (duck typing, checked at compile time). Rust traits and PHP interfaces are explicit.",
    },
    {
      slug: "errors",
      title: "Errors are values",
      concept: "errors",
      explanation:
        "Functions return `error` as their last value; `nil` means success. The `if v, err := f(); err != nil` idiom keeps error handling local and visible – verbose, but never hidden.",
      starterCode: `package main

import (
	"errors"
	"fmt"
)

func divide(a, b int) (int, error) {
	if b == 0 {
		return 0, errors.New("division by zero")
	}
	return a / b, nil
}

func main() {
	if v, err := divide(10, 2); err == nil {
		fmt.Println("10 / 2 =", v)
	}
	if _, err := divide(1, 0); err != nil {
		fmt.Println("error:", err)
	}
}
`,
      expectedOutput: "10 / 2 = 5\nerror: division by zero",
      hint: "Wrap errors with fmt.Errorf(\"loading config: %w\", err) and unwrap with errors.Is.",
      transfer: "Same philosophy as C's return codes, but typed. Rust enforces it with Result; JS/PHP throw.",
    },
    {
      slug: "goroutines",
      title: "Goroutines & channels",
      concept: "concurrency",
      explanation:
        "`go f()` runs f concurrently on a lightweight goroutine. `sync.WaitGroup` waits for them; channels (`chan`) pass messages safely. 'Share memory by communicating.'",
      starterCode: `package main

import (
	"fmt"
	"sync"
)

func main() {
	results := make([]int, 3)
	var wg sync.WaitGroup
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			results[n] = (n + 1) * 10
		}(i)
	}
	wg.Wait()
	fmt.Println("results =", results)

	ch := make(chan string)
	go func() { ch <- "message via channel" }()
	fmt.Println(<-ch)
}
`,
      expectedOutput: "results = [10 20 30]\nmessage via channel",
      hint: "Build a worker pool: 3 goroutines reading jobs from one channel. Use `select` with a time.After timeout.",
      transfer: "Rust threads + channels (mpsc) are similar but heavier. Node uses a single-threaded event loop instead.",
    },
    {
      slug: "http",
      title: "An HTTP server in the stdlib",
      concept: "web",
      explanation:
        "Go ships a production-grade HTTP server. Frameworks like Gin or Echo only add routing sugar on top of `net/http` – learn this and every Go framework is familiar. Here we start a server, call it, and shut down.",
      starterCode: `package main

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
)

func hello(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "{\\"path\\": %q, \\"framework\\": \\"none - raw net/http\\"}", r.URL.Path)
}

func main() {
	server := httptest.NewServer(http.HandlerFunc(hello))
	defer server.Close()

	resp, err := http.Get(server.URL + "/hello")
	if err != nil {
		fmt.Println("error:", err)
		return
	}
	body, _ := io.ReadAll(resp.Body)
	fmt.Println("status:", resp.StatusCode)
	fmt.Println("body:", string(body))
}
`,
      expectedOutput: 'status: 200\nbody: {"path": "/hello", "framework": "none - raw net/http"}',
      hint: "Add a second handler with http.NewServeMux. Then read the Gin quickstart and notice it's the same shape.",
      transfer: "Node's `http.createServer` and PHP's built-in server play the same role. Express/Gin/Laravel all add: routing → middleware → data layer.",
    },
  ],

  /* ─────────────────────────── PHP ─────────────────────────── */
  php: [
    {
      slug: "hello",
      title: "Hello, <?php",
      concept: "hello",
      explanation:
        "A PHP file is a template: everything outside `<?php ... ?>` is output verbatim, everything inside is executed. `echo` writes to the response (or stdout on the CLI).",
      starterCode: `<?php
echo "Hello from PHP!\\n";
echo "Powering most of the web since 1995.\\n";
`,
      expectedOutput: "Hello from PHP!\nPowering most of the web since 1995.",
      hint: "Add `declare(strict_types=1);` at the top – modern PHP's first line. Try `print_r([1,2,3]);`.",
      transfer: "No main function – like Node, the script itself runs top to bottom. Unlike Node, each web request starts a fresh process state.",
    },
    {
      slug: "variables",
      title: "$variables & interpolation",
      concept: "variables",
      explanation:
        "Variables start with `$` and are dynamically typed. Double-quoted strings interpolate `$name`. `gettype` reveals the runtime type. PHP 8 adds optional strict typing for parameters and returns.",
      starterCode: `<?php
$name = "Ada";
$age = 42;
$pi = 3.14159;
$isAdmin = true;

echo "name=$name age=$age\\n";            // interpolation
printf("pi=%.2f isAdmin=%s\\n", $pi, $isAdmin ? "true" : "false");
echo "type of age: " . gettype($age) . "\\n";
`,
      expectedOutput: "name=Ada age=42\npi=3.14 isAdmin=true\ntype of age: integer",
      hint: "Try `\"5\" + 3` and `\"5\" . 3`. Then enable strict_types and pass a string to an int parameter.",
      transfer: "Same dynamic model as JavaScript. `.` concatenates (JS uses `+`). Static languages (C/Rust/Go) would reject `\"5\" + 3`.",
    },
    {
      slug: "control-flow",
      title: "Loops & match expression",
      concept: "control",
      explanation:
        "C-style loops, plus PHP 8's `match` – a strict (`===`) expression that returns a value, borrowed from Rust. `foreach` is the idiomatic way to iterate arrays.",
      starterCode: `<?php
for ($i = 1; $i <= 5; $i++) {
    echo $i . ($i % 2 === 0 ? " is even" : " is odd") . "\\n";
}
$code = 404;
$label = match ($code) {
    200 => "ok",
    404 => "not found",
    default => "unknown",
};
echo "$code -> $label\\n";
`,
      expectedOutput: "1 is odd\n2 is even\n3 is odd\n4 is even\n5 is odd\n404 -> not found",
      hint: "Replace match with switch and notice loose comparison (==). Use foreach with `$key => $value`.",
      transfer: "Nearly identical to the Rust lesson – PHP copied match deliberately. Compare with Go's switch.",
    },
    {
      slug: "functions",
      title: "Typed functions & arrow fns",
      concept: "functions",
      explanation:
        "Modern PHP functions declare parameter and return types. `fn(x) => expr` is a short arrow function that captures outer variables automatically – perfect for callbacks.",
      starterCode: `<?php
function square(int $x): int {
    return $x * $x;
}

$greet = fn(string $who): string => "Hi, $who";

echo $greet("learner") . "\\n";
echo "square(7) = " . square(7) . "\\n";
`,
      expectedOutput: "Hi, learner\nsquare(7) = 49",
      hint: "Use a named argument: `square(x: 7)`. Write a function with a default parameter and a nullable `?int` type.",
      transfer: "Arrow fn ≈ JS arrow function ≈ Rust closure. PHP's named arguments have no JS equivalent (JS uses object params).",
    },
    {
      slug: "arrays",
      title: "The PHP array (list + map)",
      concept: "collections",
      explanation:
        "PHP's single `array` type is both an ordered list and a hash map. `array_sum`, `array_filter`, `array_map` are your functional toolkit; `implode` joins into a string.",
      starterCode: `<?php
$scores = [90, 72, 85, 60];
$total = array_sum($scores);
$passing = array_filter($scores, fn($s) => $s >= 70);

printf("count=%d total=%d avg=%.2f\\n", count($scores), $total, $total / count($scores));
echo "passing=" . implode(",", $passing) . "\\n";

$ages = ["Ada" => 36, "Linus" => 54];   // associative array
$ages["Grace"] = 85;
echo "Grace is {$ages['Grace']} - entries: " . count($ages) . "\\n";
`,
      expectedOutput: "count=4 total=307 avg=76.75\npassing=90,72,85\nGrace is 85 - entries: 3",
      hint: "Use array_map to double every score. Use the spread operator `[...$a, ...$b]` to merge.",
      transfer: "One type does the job of Go's slice+map or JS's Array+Map. Laravel wraps it in the Collection class.",
    },
    {
      slug: "classes",
      title: "Classes & constructor promotion",
      concept: "structs",
      explanation:
        "PHP 8 constructor promotion declares and assigns properties in one place. Objects are passed by handle, so `moveBy` mutates the same `Point` – no pointer syntax needed.",
      starterCode: `<?php
class Point {
    public function __construct(
        public string $name,
        public int $x = 0,
        public int $y = 0,
    ) {}

    public function moveBy(int $dx, int $dy): void {
        $this->x += $dx;
        $this->y += $dy;
    }
}

$p = new Point("origin");
$p->moveBy(3, 4);
echo "{$p->name} moved to ({$p->x}, {$p->y})\\n";
`,
      expectedOutput: "origin moved to (3, 4)",
      hint: "Add `readonly` to the properties and try to mutate. Create an interface Shape and an enum Status (PHP 8.1).",
      transfer: "This is the OOP flavour of Go's/Rust's struct+methods. Laravel's Eloquent models are just classes like this.",
    },
    {
      slug: "exceptions",
      title: "try / catch / finally",
      concept: "errors",
      explanation:
        "PHP uses exceptions. `throw` unwinds the stack until a matching `catch`; `finally` always runs. Frameworks catch at the top and convert to HTTP 500 / 404 responses.",
      starterCode: `<?php
function divide(int $a, int $b): int {
    if ($b === 0) {
        throw new InvalidArgumentException("division by zero");
    }
    return intdiv($a, $b);
}

try {
    echo "10 / 2 = " . divide(10, 2) . "\\n";
    echo "1 / 0 = " . divide(1, 0) . "\\n";
} catch (InvalidArgumentException $e) {
    echo "error: " . $e->getMessage() . "\\n";
} finally {
    echo "cleanup always runs\\n";
}
`,
      expectedOutput: "10 / 2 = 5\nerror: division by zero\ncleanup always runs",
      hint: "Define `class InsufficientFunds extends DomainException` and catch it separately from \\Throwable.",
      transfer: "Identical to JavaScript's try/catch/finally. Go and Rust avoid exceptions entirely – compare the three lessons side by side.",
    },
    {
      slug: "html-template",
      title: "PHP renders HTML natively",
      concept: "web",
      explanation:
        "This is PHP's superpower: mix HTML and logic. `<?= ?>` echoes, `foreach: ... endforeach;` is the template syntax. Run it, then open the **Screen** tab to see the rendered page. Laravel's Blade and Symfony's Twig are this idea, made safe and pretty.",
      starterCode: `<?php
$items = ["Learn the concept", "Map it to a new language", "Build the same app again"];
$title = "PHP renders HTML natively";
?>
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; padding: 24px; background: #f8fafc">
  <h1 style="color:#7c3aed"><?= htmlspecialchars($title) ?></h1>
  <ol>
    <?php foreach ($items as $item): ?>
      <li><?= htmlspecialchars($item) ?></li>
    <?php endforeach; ?>
  </ol>
  <p>Rendered at <?= date("H:i:s") ?> by PHP <?= PHP_VERSION ?></p>
</body>
</html>
`,
      expectedOutput: null,
      hint: "Remove htmlspecialchars and put `<script>alert(1)</script>` in $title – that is XSS. Templates exist to prevent it.",
      transfer: "Node does this with JSX/EJS/Next.js; Go with html/template; Rust with Askama/Tera. The concept 'template + escaping' is universal.",
    },
  ],

  /* ─────────────────────────── NODE ─────────────────────────── */
  node: [
    {
      slug: "hello",
      title: "Hello, console.log",
      concept: "hello",
      explanation:
        "Node runs JavaScript outside the browser. There's no `main` – the file executes top to bottom. `console.log` writes to stdout.",
      starterCode: `console.log("Hello from Node.js!");
console.log("JavaScript outside the browser.");
`,
      expectedOutput: "Hello from Node.js!\nJavaScript outside the browser.",
      hint: "Print `process.version` and `process.platform`. Try `console.error` and see where it shows up.",
      transfer: "Same 'script' model as PHP. Compiled languages (C, Rust, Go) need an explicit main.",
    },
    {
      slug: "variables",
      title: "const, let & dynamic types",
      concept: "variables",
      explanation:
        "`const` prevents reassignment, `let` allows it; never use `var`. Types belong to values, not variables (`typeof`). Template literals use backticks and `${}`.",
      starterCode: `const name = "Ada";        // cannot be reassigned
let counter = 0;           // can be reassigned
counter += 1;
const pi = 3.14159;
const isSafe = true;

console.log(\`name=\${name} counter=\${counter}\`);
console.log(\`pi=\${pi.toFixed(2)} isSafe=\${isSafe}\`);
console.log("typeof pi:", typeof pi);
`,
      expectedOutput: "name=Ada counter=1\npi=3.14 isSafe=true\ntypeof pi: number",
      hint: "Try `\"5\" + 3` vs `\"5\" - 3`. Then install TypeScript mentally: how would static types have helped?",
      transfer: "JS has one `number` type (float64). Go/Rust/C distinguish int from float – a common source of bugs when porting.",
    },
    {
      slug: "control-flow",
      title: "Loops & switch",
      concept: "control",
      explanation:
        "C-style syntax again. Use `===` for strict equality (`==` coerces types). `for...of` iterates values of any iterable; `switch` falls through without `break`.",
      starterCode: `for (let i = 1; i <= 5; i++) {
  console.log(i, i % 2 === 0 ? "is even" : "is odd");
}
const code = 404;
switch (code) {
  case 200: console.log("ok"); break;
  case 404: console.log("not found"); break;
  default: console.log("unknown");
}
`,
      expectedOutput: "1 is odd\n2 is even\n3 is odd\n4 is even\n5 is odd\nnot found",
      hint: "Remove a `break` and watch fall-through. Rewrite the loop with `for (const n of [1,2,3])`.",
      transfer: "Same as C and PHP. Go removed fall-through; Rust replaced switch with match.",
    },
    {
      slug: "functions",
      title: "Functions are values",
      concept: "functions",
      explanation:
        "Functions can be stored in variables, passed as arguments and returned – the foundation of callbacks, middleware and every Node framework. Arrow functions keep `this` lexical.",
      starterCode: `function square(x) {
  return x * x;
}
const greet = (who) => \`Hi, \${who}\`;

function applyTwice(fn, value) {   // higher-order function
  return fn(fn(value));
}

console.log(greet("learner"));
console.log("square(7) =", square(7));
console.log("applyTwice(square, 3) =", applyTwice(square, 3));
`,
      expectedOutput: "Hi, learner\nsquare(7) = 49\napplyTwice(square, 3) = 81",
      hint: "Write `function makeCounter()` that returns a closure. Express middleware is just `(req, res, next) => {}`.",
      transfer: "Rust closures and PHP arrow functions do the same. C needs function pointers; Go has first-class funcs too.",
    },
    {
      slug: "arrays-maps",
      title: "Array methods & Map",
      concept: "collections",
      explanation:
        "`reduce`, `filter`, `map` transform arrays declaratively. `Map` is a proper hash map (plain objects work too but have quirks). `.length` vs `.size` – a classic gotcha.",
      starterCode: `const scores = [90, 72, 85, 60];
const total = scores.reduce((sum, s) => sum + s, 0);
const passing = scores.filter((s) => s >= 70);

console.log(\`count=\${scores.length} total=\${total} avg=\${(total / scores.length).toFixed(2)}\`);
console.log("passing=" + passing.join(","));

const ages = new Map([["Ada", 36], ["Linus", 54]]);
ages.set("Grace", 85);
console.log("Grace is", ages.get("Grace"), "- entries:", ages.size);
`,
      expectedOutput: "count=4 total=307 avg=76.75\npassing=90,72,85\nGrace is 85 - entries: 3",
      hint: "Use Object.entries() on a plain object. Try `[...new Set([1,1,2])]` to dedupe.",
      transfer: "Compare with Rust's iterator chain and PHP's array_filter – identical shape, different names.",
    },
    {
      slug: "classes",
      title: "Classes & destructuring",
      concept: "structs",
      explanation:
        "ES6 classes are syntax over prototypes. Objects are reference types so methods mutate in place. Destructuring `{ x, y } = p` pulls fields out – used everywhere in React and Node code.",
      starterCode: `class Point {
  constructor(name, x = 0, y = 0) {
    this.name = name;
    this.x = x;
    this.y = y;
  }
  moveBy(dx, dy) {
    this.x += dx;
    this.y += dy;
  }
}

const p = new Point("origin");
p.moveBy(3, 4);
console.log(\`\${p.name} moved to (\${p.x}, \${p.y})\`);
const { x, y } = p;                 // destructuring
console.log("destructured:", x, y);
`,
      expectedOutput: "origin moved to (3, 4)\ndestructured: 3 4",
      hint: "Add a `get distance()` accessor and a `static origin()` factory. Try `JSON.stringify(p)`.",
      transfer: "Same as PHP classes. Rust/Go separate data from methods but the mental model is identical.",
    },
    {
      slug: "errors",
      title: "throw / try / catch",
      concept: "errors",
      explanation:
        "JavaScript throws exceptions. In async code, rejected promises are thrown at `await`, so the same try/catch works. Unhandled rejections crash modern Node – always catch.",
      starterCode: `function divide(a, b) {
  if (b === 0) throw new Error("division by zero");
  return a / b;
}

try {
  console.log("10 / 2 =", divide(10, 2));
  console.log("1 / 0 =", divide(1, 0));
} catch (err) {
  console.log("error:", err.message);
} finally {
  console.log("cleanup always runs");
}
`,
      expectedOutput: "10 / 2 = 5\nerror: division by zero\ncleanup always runs",
      hint: "Create `class ValidationError extends Error`. Then throw inside an async function and catch with await.",
      transfer: "Identical to PHP. Go/Rust return errors as values – read those lessons to see the trade-off.",
    },
    {
      slug: "event-loop",
      title: "async/await & the event loop",
      concept: "concurrency",
      explanation:
        "Node has one thread. Slow operations return Promises; `await` pauses *this* function while the loop runs others. `Promise.all` runs tasks concurrently – three 50ms waits take ~50ms total, not 150.",
      starterCode: `const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchUser(id) {
  await sleep(50);                    // simulate network latency
  return { id, name: \`user-\${id}\` };
}

async function main() {
  console.log("start");
  const t0 = Date.now();
  const users = await Promise.all([fetchUser(1), fetchUser(2), fetchUser(3)]);
  console.log("users:", users.map((u) => u.name).join(", "));
  console.log("concurrent:", Date.now() - t0 < 140 ? "yes" : "no");
}

main();
`,
      expectedOutput: "start\nusers: user-1, user-2, user-3\nconcurrent: yes",
      hint: "Replace Promise.all with sequential awaits and time it. Log inside setTimeout(…, 0) vs Promise.resolve().then – which prints first?",
      transfer: "Go uses goroutines, Rust uses async + Tokio, PHP (classically) just blocks. The event loop is Node's defining trait.",
    },
    {
      slug: "http",
      title: "An HTTP server from scratch",
      concept: "web",
      explanation:
        "Express, Fastify and Next.js are all built on `http.createServer`. This program starts a server on a random port, requests itself, prints the JSON and shuts down – the whole request/response cycle in 20 lines.",
      starterCode: `const http = require("http");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ path: req.url, framework: "none - raw Node" }));
});

server.listen(0, "127.0.0.1", () => {
  const { port } = server.address();
  http.get(\`http://127.0.0.1:\${port}/hello\`, (res) => {
    let body = "";
    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => {
      console.log("status:", res.statusCode);
      console.log("body:", body);
      server.close();
    });
  });
});
`,
      expectedOutput: 'status: 200\nbody: {"path":"/hello","framework":"none - raw Node"}',
      hint: "Add an `if (req.url === \"/users\")` branch – congratulations, you wrote a router. Now read the Express docs: `app.get(\"/users\", handler)`.",
      transfer: "Go's net/http lesson is the same program. Every framework = routing + middleware + data layer on top of this.",
    },
  ],
};

export const FRAMEWORK_LOOP = [
  { step: "Hello route", detail: "Get one endpoint returning text. Prove the toolchain works." },
  { step: "Routing", detail: "Path params, query strings, HTTP verbs. Where does the framework hide the switch statement?" },
  { step: "Request / Response", detail: "Parse JSON in, send JSON out, set status codes & headers." },
  { step: "Middleware", detail: "Logging, auth, CORS: a function that wraps the next one. Same idea in every framework." },
  { step: "Data layer", detail: "Connect to Postgres. ORM or raw SQL? Migrations?" },
  { step: "Validation & errors", detail: "Reject bad input early; map exceptions/Result to 4xx/5xx." },
  { step: "Auth", detail: "Sessions vs JWT. Where does the framework put the user?" },
  { step: "Testing", detail: "One unit test, one HTTP integration test. Learn the runner." },
  { step: "Ship it", detail: "Build artifact, env vars, Dockerfile, a single deploy. Then iterate." },
];

export const MINDSET_PRINCIPLES = [
  {
    title: "Concepts over syntax",
    icon: "🧭",
    body: "There are ~10 ideas in programming (state, control flow, functions, data modelling, errors, memory, concurrency, I/O, packaging, testing). Syntax is a costume. Learn the idea once; relearn only the costume.",
  },
  {
    title: "Learn sideways (the Rosetta method)",
    icon: "🪨",
    body: "When you learn something new in one language, immediately ask: how does language X do this? The comparison is what makes it stick – and it's why every lesson here has a 'Transfer' note.",
  },
  {
    title: "Build the same app five times",
    icon: "🔁",
    body: "A todo API with auth and Postgres. Build it in Node, then Go, then Rust, then PHP. Your fourth version will take a tenth of the time – that's the compounding payoff of polyglot learning.",
  },
  {
    title: "Read the error message",
    icon: "🔍",
    body: "Compilers and runtimes are tutors. Rust's errors are essays; Go's are terse; C's are cryptic. The skill is the same: read, locate, hypothesise, change one thing, rerun.",
  },
  {
    title: "Tooling first, framework second",
    icon: "🛠️",
    body: "Before any framework, know the package manager (cargo, go mod, composer, npm), the formatter, the test runner and how to build a binary. Frameworks change; the toolchain outlives them.",
  },
  {
    title: "Go one level down",
    icon: "⬇️",
    body: "Learn C to understand what Rust protects you from. Learn raw http.createServer to understand Express. Understanding the layer beneath makes the layer above obvious.",
  },
  {
    title: "Tiny loops, fast feedback",
    icon: "⚡",
    body: "Change one line, run, observe. Never write 50 lines blind. This playground exists to make that loop take seconds.",
  },
  {
    title: "Teach it back",
    icon: "🗣️",
    body: "Explain each concept in one paragraph as if to a friend. If you can't, you haven't learned it yet – you've only recognised it.",
  },
];
