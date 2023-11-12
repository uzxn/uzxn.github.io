function gougu() {
    var a, b, c, text = "结果：不是勾股数";
    a = document.getElementById("a1").value;
    b = document.getElementById("b1").value;
    c = document.getElementById("c1").value;
    if (a*a + b*b === c*c) text = "结果：是勾股数";
    document.getElementById("gougu_res").innerHTML = text;
}

function triangle() {
    var a, b, c, text;
    a = document.getElementById("a2").value;
    b = document.getElementById("b2").value;
    c = document.getElementById("c2").value;
    if (a*a + b*b > c*c) text = "结果：锐角三角形";
    else if (a*a + b*b === c*c) text = "结果：直角三角形";
    else text = "结果：钝角三角形";
    document.getElementById("triangle_res").innerHTML = text;
}

function random() {
    var x, res;
    x = document.getElementById("x").value;
    res = Math.round(Math.random() * x);
    document.getElementById("random_res").innerHTML = "结果：" + res;
}
