import { Denops } from "https://deno.land/x/denops_std@v5.0.0/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v5.0.0/variable/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v5.0.0/helper/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v5.0.0/function/mod.ts";
import {
  config,
  noteApi,
  NoteUpdateRes,
} from "https://esm.sh/joplin-api@0.5.1";

export async function main(denops: Denops): Promise<void> {
  // API
  denops.dispatcher = {
    async update(): Promise<void> {
      const id = await vars.b.get(denops, "joplin_note_id", "");
      const title = await vars.b.get(denops, "joplin_note_title", "");
      const body = await fn.join(
        denops,
        await fn.getline(denops, 1, "$"),
        "\n",
      );

      config.token = await vars.b.get(denops, "joplin_token", "");

      try {
        const res: NoteUpdateRes = await noteApi.update({
          id: id,
          title: title,
          body: body,
        });
        console.log("successfully saved:", res.title);
      } catch (e: unknown) {
        console.error(e);
      }

      await helper.execute(denops, `setlocal nomodified`);
    },
  };
}
