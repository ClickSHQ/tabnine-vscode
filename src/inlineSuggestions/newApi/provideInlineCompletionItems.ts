import * as vscode from "vscode";
import {
  AutocompleteResult,
  ResultEntry,
} from "../../binary/requests/requests";

import { completionIsAllowed } from "../../provideCompletionItems";
import runCompletion from "../../runCompletion";
import { COMPLETION_IMPORTS } from "../../selectionHandler";
import retry from "../../utils/retry";
import TabnineInlineCompletionItem from "../tabnineInlineCompletionItem";

const INLINE_REQUEST_TIMEOUT = 3000;

export default async function provideInlineCompletionItems(
  document: vscode.TextDocument,
  position: vscode.Position,
  context: vscode.InlineCompletionContextNew
): Promise<vscode.InlineCompletionListNew> {
  try {
    if (
      !completionIsAllowed(document, position) ||
      isInTheMiddleOfWord(document, position)
    ) {
      return new vscode.InlineCompletionListNew([]);
    }
    const completionInfo = context.selectedCompletionInfo;
    if (completionInfo) {
      return await getCompletionsExtendingSelectedItem(
        document,
        completionInfo,
        position
      );
    }

    return await getInlineCompletionItems(document, position);
  } catch (e) {
    console.error(`Error setting up request: ${e}`);

    return new vscode.InlineCompletionListNew([]);
  }
}

async function getInlineCompletionItems(
  document: vscode.TextDocument,
  position: vscode.Position
) {
  const isEmptyLine = document.lineAt(position.line).text.trim().length === 0;

  const response = await runCompletion(
    document,
    position,
    isEmptyLine ? INLINE_REQUEST_TIMEOUT : undefined
  );

  const completions = response?.results.map(
    (result) =>
      new TabnineInlineCompletionItem(
        result.new_prefix,
        calculateRange(position, response, result),
        getAutoImportCommand(result, response, position),
        result.completion_kind,
        result.is_cached,
        response.snippet_intent
      )
  );

  return new vscode.InlineCompletionListNew(completions || []);
}

async function getCompletionsExtendingSelectedItem(
  document: vscode.TextDocument,
  completionInfo: vscode.SelectedCompletionInfoNew,
  position: vscode.Position
) {
  const response = await retry(
    () =>
      runCompletion(
        document,
        completionInfo.range.start,
        undefined,
        completionInfo.text
      ),
    (res) => !res?.results.length,
    2
  );

  const result = findMostRelevantSuggestion(response, completionInfo);

  const completion =
    result &&
    response &&
    new TabnineInlineCompletionItem(
      result.new_prefix.replace(response.old_prefix, completionInfo.text),
      new vscode.Range(
        completionInfo.range.start,
        completionInfo.range.end.translate(
          undefined,
          result.new_prefix.replace(completionInfo.text, "").length
        )
      ),
      getAutoImportCommand(result, response, position),
      result.completion_kind,
      result.is_cached,
      response.snippet_intent
    );

  return new vscode.InlineCompletionListNew((completion && [completion]) || []);
}

function findMostRelevantSuggestion(
  response: AutocompleteResult | null | undefined,
  completionInfo: vscode.SelectedCompletionInfoNew
) {
  return response?.results
    .filter(({ new_prefix }) => new_prefix.startsWith(completionInfo.text))
    .sort(
      (a, b) => parseInt(b.detail || "", 10) - parseInt(a.detail || "", 10)
    )[0];
}

function getAutoImportCommand(
  result: ResultEntry,
  response: AutocompleteResult | undefined,
  position: vscode.Position
): vscode.Command {
  return {
    arguments: [
      {
        currentCompletion: result.new_prefix,
        completions: response?.results,
        position,
        limited: response?.is_locked,
        snippetIntent: response?.snippet_intent,
        oldPrefix: response?.old_prefix,
      },
    ],
    command: COMPLETION_IMPORTS,
    title: "accept completion",
    tooltip: "tabnine"
  };
}

function calculateRange(
  position: vscode.Position,
  response: AutocompleteResult,
  result: ResultEntry
): vscode.Range {
  return new vscode.Range(
    position.translate(0, -response.old_prefix.length),
    position.translate(0, result.old_suffix.length)
  );
}

function isInTheMiddleOfWord(
  document: vscode.TextDocument,
  position: vscode.Position
): boolean {
  const nextCharacter = document.getText(
    new vscode.Range(position, position.translate(0, 1))
  );
  return !isClosingCharacter(nextCharacter) && !!nextCharacter.trim();
}

function isClosingCharacter(nextCharacter: string) {
  const closingCharacters = ['"', "'", "`", "]", ")", "}", ">"];
  return closingCharacters.includes(nextCharacter);
}