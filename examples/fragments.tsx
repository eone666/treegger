import { mount } from "treegger";

mount(<>
  <h2>First root</h2>
  <p>Second root, no wrapper</p>
</>, document.getElementById("app")!);
