import {
  ActionFlags,
  ActionResult,
  Actions,
  BaseKind,
  Context,
  DduItem,
} from "https://deno.land/x/ddu_vim@v2.9.2/types.ts";
import {
  autocmd,
  Denops,
  fn,
  op,
  vars,
} from "https://deno.land/x/ddu_vim@v2.9.2/deps.ts";
import { config, noteApi } from "https://esm.sh/joplin-api@0.5.1";
// https://www.npmjs.com/package/joplin-api

export type ActionData = {
  token: string;
  id: string;
  parent_id: string;
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
        config.token = action.token;

        const noteRes = await noteApi.get(action.id, [
          "id",
          "title",
          "body",
          "is_todo",
          "parent_id",
        ]);

        await args.denops.cmd(`new ${noteRes.title}`);
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
              `call denops#request('joplin', 'update', [])`
            );
          }
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

      const cwd = action.parent_id;
      const input = await fn.input(args.denops, "Please input note name: ");

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

      const cwd = action.parent_id;
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
  };
  override params(): Params {
    return {};
  }
}
