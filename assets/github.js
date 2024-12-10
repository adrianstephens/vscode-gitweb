const vscroll 		= new ScrollBar(document.body, document.documentElement, false);

document.addEventListener("scroll", event => vscroll.update());
