import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { AuthenticationGate } from "./AuthenticationGate";

test("authentication gate does not render protected content before session validation", () => {
  const markup = renderToStaticMarkup(
    createElement(AuthenticationGate, null, createElement("div", null, "protected consultation content")),
  );
  expect(markup).toContain("Checking secure session");
  expect(markup).not.toContain("protected consultation content");
});
