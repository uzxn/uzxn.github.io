function phi_rks() {
    var lv, acc, res;
    lv = Number(document.getElementById("lv").value);
    acc = Number(document.getElementById("acc").value);
    if (acc < 70) {
        res = 0;
    } else {
        res = Math.pow((acc - 55) / 45, 2) * lv;
    }
    res = "单曲 rks：" + res.toFixed(4);
    document.getElementById("phi_rks_res").innerHTML = res;
}

function ma_acc() {
    var best, cool, good, miss;
    best = Number(document.getElementById("best").value);
    cool = Number(document.getElementById("cool").value);
    good = Number(document.getElementById("good").value);
    miss = Number(document.getElementById("miss").value);
    res = (best * 100 + cool * 75 + good * 40) / (best + cool + good + miss);
    res = "ACC：" + res.toFixed(4) + "%";
    document.getElementById("ma_acc_res").innerHTML = res;
}

function malody_acc() {
    var dan, n1, n2, n3, n4, n12, n123, n124, n134, n234, n1234, o1, o2, o3, o4, std, s, s2, s3, s4, a234, a134, a124, a123, a1, a2, a3, a4, str1, str2, str3, str4;
    var n1tbl = [492, 695, 1397, 1055, 1865, 1282, 1694, 1701, 2237, 2374, 2034, 1952, 2107, 2518, 2634, 2734, 2483, 2846, 3789, 3888, 2828];
    var n2tbl = [529, 621, 1090, 1489, 1434, 1706, 1636, 1799, 2081, 1889, 1740, 2013, 1953, 2636, 2212, 2417, 2276, 2260, 3663, 3030, 3362];
    var n3tbl = [595, 718, 805, 1288, 1284, 1473, 1803, 2132, 2280, 2142, 2270, 1953, 2386, 2326, 2336, 3089, 2921, 2333, 2424, 3581, 3393];
    var n4tbl = [681, 1279, 1212, 1789, 1839, 1939, 2115, 1899, 2000, 1810, 2166, 2111, 2674, 2511, 2602, 2974, 3194, 3347, 3255, 3700, 5100];
    o1 = Number(document.getElementById("o1").value);
    o2 = Number(document.getElementById("o2").value);
    o3 = Number(document.getElementById("o3").value);
    o4 = Number(document.getElementById("o4").value);
    dan = Number(document.getElementById("dan").value);
    std = dan > 10 ? 96 : 95;
    n1 = n1tbl[dan];
    n2 = n2tbl[dan];
    n3 = n3tbl[dan];
    n4 = n4tbl[dan];
    n12 = n1 + n2;
    n123 = n1 + n2 + n3;
    n124 = n1 + n2 + n4;
    n134 = n1 + n3 + n4;
    n234 = n4 + n2 + n3;
    n1234 = n1 + n2 + n3 + n4;
    s2 = (o2 * n12 - o1 * n1) / n2;
    s3 = (o3 * n123 - o2 * n12) / n3;
    s4 = (o4 * n1234 - o3 * n123) / n4;
    a234 = (s2 * n2 + s3 * n3 + s4 * n4) / n234;
    a124 = (s2 * n2 + o1 * n1 + s4 * n4) / n124;
    a134 = (o1 * n1 + s3 * n3 + s4 * n4) / n134;
    a123 = (o1 * n1 + s2 * n2 + s3 * n3) / n123;
    a1 = (std - n234 * a234 / n1234) * n1234 / n1;
    a2 = (std - n134 * a134 / n1234) * n1234 / n2;
    a3 = (std - n124 * a124 / n1234) * n1234 / n3;
    a4 = (std - n123 * a123 / n1234) * n1234 / n4;
    s = "<b>&darr; 单曲 ACC</b><br>";
    s += "第一首：" + o1.toFixed(2) + "%<br>";
    s += "第二首：" + s2.toFixed(2) + "%<br>";
    s += "第三首：" + s3.toFixed(2) + "%<br>";
    s += "第四首：" + s4.toFixed(2) + "%<br>";
    if (o4 < std) {
        s += "<b>&darr; 过段所需单曲 ACC（其余三首不变时）</b><br>";
        str1 = "第一首：仅提高单曲 ACC 无法过段<br>";
        str2 = "第二首：仅提高单曲 ACC 无法过段<br>";
        str3 = "第三首：仅提高单曲 ACC 无法过段<br>";
        str4 = "第四首：仅提高单曲 ACC 无法过段<br>";
        if (a1 <= 100) str1 = "第一首：" + a1.toFixed(2) + "%<br>";
        if (a2 <= 100) str2 = "第二首：" + a2.toFixed(2) + "%<br>";
        if (a3 <= 100) str3 = "第三首：" + a3.toFixed(2) + "%<br>";
        if (a4 <= 100) str4 = "第四首：" + a4.toFixed(2) + "%<br>";
        s += (str1 + str2 + str3 + str4);
    }
    document.getElementById("malody_acc_res").innerHTML = s;
}