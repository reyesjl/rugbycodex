type ProposedAssignment = {
  segment_id: string;
  group_id: string;
};

export function validateAutoAssignments(
  assignments: ProposedAssignment[],
  knownSegments: Set<string>,
  knownGroups: Set<string>
) {
  if (!Array.isArray(assignments)) {
    throw new Error("Invalid assignments payload.");
  }

  if (assignments.length > 15) {
    throw new Error("Too many assignments. Max 15 per request.");
  }

  for (const item of assignments) {
    const segmentId = String(item?.segment_id ?? "").trim();
    const groupId = String(item?.group_id ?? "").trim();

    if (!segmentId || !knownSegments.has(segmentId)) {
      throw new Error(`Invalid segment_id: ${segmentId || "(missing)"}`);
    }

    if (!groupId || !knownGroups.has(groupId)) {
      throw new Error(`Invalid group_id: ${groupId || "(missing)"}`);
    }
  }
}
