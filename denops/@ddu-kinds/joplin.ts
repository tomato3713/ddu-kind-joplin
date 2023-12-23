import {
  ActionFlags,
  ActionResult,
  Actions,
  BaseKind,
  Context,
  DduItem,
} from "https://deno.land/x/ddu_vim@v3.8.1/types.ts";
import { Denops } from "https://deno.land/x/denops_core@v5.0.0/denops.ts";
import * as fn from "https://deno.land/x/denops_std@v5.2.0/function/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v5.2.0/variable/mod.ts";
import * as op from "https://deno.land/x/denops_std@v5.2.0/option/mod.ts";
import * as autocmd from "https://deno.land/x/denops_std@v5.2.0/autocmd/mod.ts";
import { config, folderApi, noteApi } from "https://esm.sh/joplin-api@0.5.1";
// https://www.npmjs.com/package/joplin-api

export type ActionData = {
  token: string;
  id: string;
  parent_id: string;
  title: string;
  isFolder: boolean;
  is_todo: boolean;
  todo_completed: boolean;
  todo_due: boolean;
};

export type Params = Record<never, never>;

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
    open: async (args: {
      denops: Denops;
      context: Context;
      actionParams: unknown;
      items: DduItem[];
    }) => {
      for (const item of args.items) {
        const action = item?.action as ActionData;
        if (action.isFolder) {
          console.log("not supported open action for folder");
          return ActionFlags.None;
        }
        config.token = action.token;

        const noteRes = await noteApi.get(action.id, [
          "id",
          "title",
          "body",
          "is_todo",
          "todo_due",
          "todo_completed",
          "parent_id",
        ]);

        // Joplin allows "/" in titles
        await args.denops.cmd(
          `new ${noteRes.id}`,
        );
        await args.denops.call("setline", 1, noteRes.body.split(/\r?\n/));
        // clear undo history.
        const old_ul = await op.undolevels.getLocal(args.denops);
        await op.undolevels.setLocal(args.denops, -1);
        await fn.feedkeys(args.denops, "a \x08", "x");
        await op.undolevels.setLocal(args.denops, old_ul);

        await vars.b.set(args.denops, "joplin_note_id", noteRes.id);
        await vars.b.set(args.denops, "joplin_note_title", noteRes.title);
        await vars.b.set(args.denops, "joplin_token", action.token);
        await op.bufhidden.setLocal(args.denops, "");
        await op.modified.setLocal(args.denops, false);
        await op.filetype.setLocal(args.denops, "markdown");

        // 書き込みイベントを起点にして，/denops/joplin/main.tsで定義したAPIを実行する．
        await autocmd.group(
          args.denops,
          "joplin",
          (helper: autocmd.GroupHelper) => {
            helper.define(
              "BufWriteCmd" as autocmd.AutocmdEvent,
              "<buffer>",
              `call denops#request('joplin', 'update', [])`,
            );
          },
        );
      }

      return ActionFlags.None;
    },
    newNote: async (args: {
      denops: Denops;
      context: Context;
      actionParams: unknown;
      items: DduItem[];
    }): Promise<ActionFlags | ActionResult> => {
      const action = args.items[0].action as ActionData;

      const cwd = action.isFolder ? action.id : action.parent_id;
      const input = await fn.input(
        args.denops,
        "Please input new folder name: ",
      );

      if (input === "") {
        return ActionFlags.Persist;
      }

      await noteApi.create({
        parent_id: cwd,
        title: input,
        body: `# ${input}\n`,
      });

      return ActionFlags.RefreshItems;
    },
    newTodo: async (args: {
      denops: Denops;
      context: Context;
      actionParams: unknown;
      items: DduItem[];
    }): Promise<ActionFlags | ActionResult> => {
      const action = args.items[0].action as ActionData;

      const cwd = action.isFolder ? action.id : action.parent_id;
      const input = await fn.input(args.denops, "Please input todo name: ");

      if (input === "") {
        return ActionFlags.Persist;
      }

      await noteApi.create({
        parent_id: cwd,
        title: input,
        is_todo: 1,
        body: `# ${input}\n`,
      });

      return ActionFlags.RefreshItems;
    },
    rename: async (args: {
      denops: Denops;
      context: Context;
      actionParams: unknown;
      items: DduItem[];
    }): Promise<ActionFlags | ActionResult> => {
      const action = args.items[0].action as ActionData;

      const input = await fn.input(
        args.denops,
        `Please input new item name (${action.title} ->): `,
      );

      if (input === "") {
        return ActionFlags.Persist;
      }

      try {
        if (action.isFolder) {
          await folderApi.update({
            id: action.id,
            title: input,
          });
        } else {
          await noteApi.update({
            id: action.id,
            title: input,
          });
        }
      } catch {
        console.log(`Faild to rename item: (${action.title}->${input})`);
      }
      return ActionFlags.RefreshItems;
    },
    newFolder: async (args: {
      denops: Denops;
      context: Context;
      actionParams: unknown;
      items: DduItem[];
    }): Promise<ActionFlags | ActionResult> => {
      const action = args.items[0].action as ActionData;

      const cwd = action.isFolder ? action.id : action.parent_id;
      const input = await fn.input(args.denops, "Please input folder name: ");

      if (input === "") {
        return ActionFlags.Persist;
      }

      try {
        await folderApi.create({
          parent_id: cwd,
          title: input,
        });
      } catch {
        console.log(`Faild to new folder`);
      }

      return ActionFlags.RefreshItems;
    },
    delete: async (args: {
      denops: Denops;
      context: Context;
      actionParams: unknown;
      items: DduItem[];
    }): Promise<ActionFlags | ActionResult> => {
      const titleList = args.items.map((item) => {
        const action = item.action as ActionData;
        return action.title;
      });
      const input = await fn.input(
        args.denops,
        `Want to delete: ${titleList.join("\n")}? (Yes/No)`,
      );
      if (input !== "Yes") {
        return ActionFlags.Persist;
      }

      for (const item of args.items) {
        const action = item.action as ActionData;
        try {
          action.isFolder
            ? await folderApi.remove(action.id)
            : await noteApi.remove(action.id);
        } catch {
          console.log("Faild to remove file: ", action.title);
        }
      }
      return ActionFlags.RefreshItems;
    },
  };
  override params(): Params {
    return {};
  }
}
