"use client";

import { newId } from "@/domain/playbook/formations";
import { EMPTY_EVALUATION_DATA, type Criterion, type Evaluation, type EvaluationData, type TestSession } from "@/domain/team/evaluation";
import { read, useStored, write } from "./store";

const key = (workspaceId: string) => `evaluation.${workspaceId}`;

function load(workspaceId: string): EvaluationData {
  return read(key(workspaceId), EMPTY_EVALUATION_DATA);
}

function save(workspaceId: string, change: (data: EvaluationData) => EvaluationData) {
  write(key(workspaceId), change(load(workspaceId)));
}

export function useEvaluationData(workspaceId: string | undefined): EvaluationData {
  return useStored(workspaceId ? key(workspaceId) : "evaluation.none", EMPTY_EVALUATION_DATA);
}

export type EvaluationInput = Pick<Evaluation, "playerId" | "date" | "ratings" | "strengths" | "improve" | "notes">;

export const evaluationRepo = {
  setCriteria(workspaceId: string, criteria: Criterion[]) {
    save(workspaceId, (d) => ({ ...d, criteria }));
  },
  /** Saves an evaluation; the criteria in use are kept with the data from the first one on. */
  saveEvaluation(workspaceId: string, criteria: Criterion[], input: EvaluationInput, id: string | null = null) {
    const now = new Date().toISOString();
    save(workspaceId, (d) => ({
      ...d,
      criteria: d.criteria ?? criteria,
      evaluations: id
        ? d.evaluations.map((e) => (e.id === id ? { ...e, ...input, updatedAt: now } : e))
        : [...d.evaluations, { ...input, id: newId("eval"), createdAt: now, updatedAt: now }],
    }));
  },
  removeEvaluation(workspaceId: string, id: string) {
    save(workspaceId, (d) => ({ ...d, evaluations: d.evaluations.filter((e) => e.id !== id) }));
  },
  addSession(workspaceId: string, date: string, title: string): TestSession {
    const session: TestSession = { id: newId("ts"), date, title: title.trim(), results: {}, createdAt: new Date().toISOString() };
    save(workspaceId, (d) => ({ ...d, tests: [...d.tests, session] }));
    return session;
  },
  updateSession(workspaceId: string, id: string, change: (s: TestSession) => TestSession) {
    save(workspaceId, (d) => ({ ...d, tests: d.tests.map((s) => (s.id === id ? change(s) : s)) }));
  },
  removeSession(workspaceId: string, id: string) {
    save(workspaceId, (d) => ({ ...d, tests: d.tests.filter((s) => s.id !== id) }));
  },
};
