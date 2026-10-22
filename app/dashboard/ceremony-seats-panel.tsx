"use client";
import { useState, type ComponentProps } from 'react';
import { CeremonySeatsWorkspace } from './ceremony-seats-workspace';
import { CeremonyAssignmentHistory } from './ceremony-assignment-history';
import { readCeremonyHistory } from './ceremony-history-read';
export function CeremonySeatsPanel({ revoke, loadHistory = readCeremonyHistory, ...props }: ComponentProps<typeof CeremonySeatsWorkspace> & {
  revoke: ComponentProps<typeof CeremonyAssignmentHistory>['revoke'];
  loadHistory?: ComponentProps<typeof CeremonyAssignmentHistory>['load'];
}) {
  const [historyVersion,setHistoryVersion] = useState(0);
  return <><CeremonySeatsWorkspace {...props} save={async c => {const result=await props.save(c);if(result.status==='saved')setHistoryVersion(v=>v+1);return result;}} revokeSeat={async c => {const result=await props.revokeSeat(c);if(result.status==='saved')setHistoryVersion(v=>v+1);return result;}}/><CeremonyAssignmentHistory planId={props.desk.planId} refreshKey={historyVersion} load={loadHistory} revoke={revoke}/></>;
}
