"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getFromServer } from "./action";

export default function Client({ server }: { server: string }) {
  const [json, setJson] = useState<string>();
  const [action, setAction] = useState<string>();
  const [cookie, setCookie] = useState<string>();

  const [text, setText] = useState<string>();

  useEffect(() => {
    fetch("/test", { method: "POST", body: "Hello from frontend!" })
      .then((res) => res.text())
      .then((text) => setText(text));
  }, []);

  useEffect(() => {
    console.log("Fetch");

    fetch("/test", { method: "POST", body: "Hello from frontend!" })
      .then((res) => res.json())
      .then(setJson)
      .catch((err) => err.toString());
  }, []);

  useEffect(() => {
    getFromServer()
      .then(setAction)
      .catch((err) => err.toString());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCookie(document.cookie);
  }, []);

  return (
    <div className="prose p-4 prose-sm max-w-none">
      <h3 className="text-xl">Server Page</h3>
      <p>
        <code>{server}</code>
      </p>

      <h3>Server Action</h3>
      <p>{action}</p>

      <h3 className="text-xl">Frontend cookie (after load)</h3>
      <p>{cookie}</p>

      <h3 className="text-xl">Route Handler API response</h3>
      <pre className="text-xs max-w-lg">
        <code>{JSON.stringify(json, null, 2)}</code>
      </pre>

      <h3 className="text-xl">Next.js Image</h3>
      <p>
        <Image src="/image.png" width={500} height={210} alt="Local Image" />
      </p>
      <p>
        <small>⬇️ Should be the same after reload (cached by Next.js)</small>
        <br />
        <Image
          src="https://picsum.photos/1000/420"
          width={500}
          height={210}
          alt="Remote Image"
        />
      </p>
    </div>
  );
}
