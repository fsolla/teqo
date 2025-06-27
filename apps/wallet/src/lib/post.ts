export const post = <Body extends Record<string, unknown>>(
  url: string,
  body: Body
) =>
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).then((response) => response.json());
