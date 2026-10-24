import { html, mount } from "treegger";

mount(html`<h2>First root</h2><p>Second root, no wrapper</p>`, document.querySelector("#app"));
