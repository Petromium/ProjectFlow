# AI Assistant Enhancement Proposal
## Transforming from Information Retrieval to Action-Oriented System

---

## Executive Summary

**Current State:** The AI Assistant can analyze data and create tasks/risks/issues, but executes immediately without user confirmation. Limited to CREATE operations only.

**Goal:** Transform into a powerful, action-oriented assistant that can perform CRUD operations across all entities with a preview/confirmation workflow, making it a competitive differentiator.

**Key Principle:** **Trust but Verify** - Show changes before executing, allow user confirmation/rejection.

---

## Current State Analysis

### ✅ What Works
1. **Analysis Functions:** `get_project_overview`, `analyze_project_risks`, `analyze_resource_workload`
2. **Basic CREATE:** Tasks, Risks, Issues can be created
3. **Function Calling:** Gemini/OpenAI function calling infrastructure exists
4. **Authorization:** Project access verification in place

### ❌ Critical Gaps

1. **No Preview/Confirmation System**
   - Functions execute immediately
   - No way to review changes before committing
   - High risk of unintended actions

2. **Limited CRUD Operations**
   - Only CREATE operations exist
   - No UPDATE or DELETE capabilities
   - Cannot modify existing entities

3. **No Global Access**
   - AI Assistant only accessible via sidebar navigation
   - No keyboard shortcut (Cmd/Ctrl+K)
   - No floating action button

4. **No Context Awareness**
   - AI doesn't know what page user is viewing
   - Cannot reference current selection/context
   - Limited to project-level operations

5. **No Audit Trail**
   - AI actions not clearly logged
   - Cannot track "AI-initiated" vs "user-initiated" changes
   - No rollback capability

6. **Limited Function Set**
   - Only 6 functions total
   - Missing: Update tasks, delete items, assign resources, update status, etc.
   - No bulk operations

---

## Proposed Architecture

### Phase 1: Preview & Confirmation System (Foundation)

**Core Concept:** Two-stage execution
1. **Preview Stage:** AI proposes actions, shows changes
2. **Confirmation Stage:** User reviews and approves/rejects

**Implementation:**

```typescript
// New response type
interface AIActionPreview {
  actionId: string;           // Unique ID for this action
  type: 'create' | 'update' | 'delete' | 'bulk';
  entity: 'task' | 'risk' | 'issue' | 'resource' | 'project' | ...;
  description: string;         // Human-readable description
  changes: ActionChange[];    // Detailed changes
  affectedIds?: number[];     // IDs of affected entities
  preview: any;               // Preview of result
}

interface ActionChange {
  field: string;
  oldValue?: any;
  newValue: any;
  type: 'add' | 'modify' | 'remove';
}
```

**Flow:**
1. User: "Update task 'Foundation Work' to 80% progress"
2. AI: Analyzes request → Calls `preview_update_task` function
3. Backend: Returns preview (doesn't execute)
4. Frontend: Shows preview modal with diff view
5. User: Reviews → Approves or Rejects
6. Backend: Executes only if approved

**Benefits:**
- Prevents accidental changes
- Builds user trust
- Allows AI to be more aggressive in suggestions
- Clear audit trail

---

### Phase 2: Extended CRUD Operations

**New Functions Needed:**

#### Task Operations
- `update_task` - Update existing task
- `delete_task` - Delete task
- `bulk_update_tasks` - Update multiple tasks
- `assign_resource_to_task` - Assign resource
- `update_task_status` - Change status
- `update_task_progress` - Update progress
- `add_task_dependency` - Create dependency

#### Risk Operations
- `update_risk` - Update risk details
- `delete_risk` - Delete risk
- `update_risk_status` - Change status
- `add_mitigation_plan` - Add mitigation

#### Issue Operations
- `update_issue` - Update issue
- `delete_issue` - Delete issue
- `resolve_issue` - Mark as resolved
- `assign_issue` - Assign to user

#### Resource Operations
- `create_resource` - Create resource
- `update_resource` - Update resource
- `delete_resource` - Delete resource
- `assign_resource_to_task` - Assign to task
- `update_resource_availability` - Update availability

#### Project Operations
- `update_project` - Update project details
- `update_project_status` - Change status
- `duplicate_project` - Duplicate project

#### Material Operations
- `create_material` - Add material to task
- `record_consumption` - Record material consumption
- `record_delivery` - Record material delivery

#### Cost Operations
- `create_cost_item` - Add cost item
- `update_cost_item` - Update cost
- `delete_cost_item` - Remove cost item

**Total:** ~30+ new functions

---

### Phase 3: Global Access & UI Enhancements

#### 1. Command Palette (Cmd/Ctrl+K)
- **Inspiration:** VS Code, Linear, Notion
- **Features:**
  - Quick access from anywhere
  - Context-aware suggestions
  - Recent commands
  - Quick actions (create task, analyze risks, etc.)

#### 2. Floating AI Button
- **Position:** Bottom-right corner
- **Behavior:**
  - Always visible
  - Click opens AI Assistant
  - Shows notification badge for pending actions
  - Minimizable to chat bubble

#### 3. Context-Aware AI
- **Current Page Detection:**
  - If on Task page → AI knows current task
  - If on Risks page → AI knows current risk
  - If on Resources page → AI knows current resource
- **Selection Awareness:**
  - "Update this task" → Uses selected task
  - "Delete these risks" → Uses selected risks

#### 4. Action Preview Modal
- **Components:**
  - Diff view (before/after)
  - Affected entities list
  - Impact analysis
  - Warning messages
  - Approve/Reject buttons

---

### Phase 4: Enhanced Function Definitions

**Current Problem:** Functions are too generic, AI makes assumptions

**Solution:** More specific, context-aware functions

**Example Evolution:**

**Before:**
```typescript
create_task: {
  title: string,
  description?: string,
  // ... generic fields
}
```

**After:**
```typescript
create_task: {
  projectId: number,
  name: string,
  parentTaskId?: number,        // Can create subtasks
  wbsCode?: string,              // Can specify WBS
  assignToUserId?: string,       // Specific user ID
  assignToResourceId?: number,   // Or resource ID
  estimatedHours?: number,
  startDate?: string,
  endDate?: string,
  priority: 'low' | 'medium' | 'high' | 'critical',
  status: 'not-started' | 'in-progress' | ...,
  discipline?: string,
  // ... all task fields
}

update_task: {
  taskId: number,
  changes: {
    name?: string,
    status?: string,
    progress?: number,
    assignedTo?: string,
    // ... only changed fields
  }
}

bulk_update_tasks: {
  taskIds: number[],
  changes: {
    status?: string,
    priority?: string,
    assignedTo?: string,
  }
}
```

---

## Technical Implementation Plan

### Backend Changes

#### 1. New Preview System (`server/aiAssistant.ts`)

```typescript
// New function execution mode
enum ExecutionMode {
  PREVIEW = 'preview',    // Return preview, don't execute
  EXECUTE = 'execute'     // Actually perform the action
}

async function executeFunctionCall(
  name: string,
  args: any,
  storage: IStorage,
  userId: string,
  mode: ExecutionMode = ExecutionMode.EXECUTE  // Default to execute for backward compat
): Promise<string> {
  if (mode === ExecutionMode.PREVIEW) {
    return generatePreview(name, args, storage, userId);
  }
  // ... existing execution logic
}

async function generatePreview(
  name: string,
  args: any,
  storage: IStorage,
  userId: string
): Promise<string> {
  // Fetch current state
  // Calculate changes
  // Return preview JSON
}
```

#### 2. New API Endpoint for Preview

```typescript
app.post('/api/ai/preview-action', isAuthenticated, async (req, res) => {
  const { functionName, args } = req.body;
  const preview = await generatePreview(functionName, args, storage, userId);
  res.json({ preview, actionId: generateActionId() });
});

app.post('/api/ai/execute-action', isAuthenticated, async (req, res) => {
  const { actionId, functionName, args } = req.body;
  // Verify actionId matches preview
  const result = await executeFunctionCall(functionName, args, storage, userId, ExecutionMode.EXECUTE);
  // Log to audit trail
  await logAIAction(userId, actionId, functionName, args, result);
  res.json(result);
});
```

#### 3. Audit Trail System

```typescript
// New table: ai_action_logs
interface AIActionLog {
  id: number;
  userId: string;
  projectId: number | null;
  actionId: string;
  functionName: string;
  args: JSONB;
  result: JSONB;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  executedAt: timestamp;
  createdAt: timestamp;
}
```

---

### Frontend Changes

#### 1. Command Palette Component

```typescript
// client/src/components/CommandPalette.tsx
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  
  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // ... command palette UI
}
```

#### 2. Action Preview Modal

```typescript
// client/src/components/AIActionPreviewModal.tsx
export function AIActionPreviewModal({
  preview,
  onApprove,
  onReject,
}: {
  preview: AIActionPreview;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <Dialog>
      <DialogHeader>
        <DialogTitle>Review AI Action</DialogTitle>
        <DialogDescription>{preview.description}</DialogDescription>
      </DialogHeader>
      <DialogContent>
        {/* Diff View */}
        <DiffView changes={preview.changes} />
        {/* Affected Entities */}
        <AffectedEntitiesList ids={preview.affectedIds} />
        {/* Warnings */}
        {preview.warnings && <WarningsList warnings={preview.warnings} />}
      </DialogContent>
      <DialogFooter>
        <Button variant="outline" onClick={onReject}>Reject</Button>
        <Button onClick={onApprove}>Approve & Execute</Button>
      </DialogFooter>
    </Dialog>
  );
}
```

#### 3. Floating AI Button

```typescript
// client/src/components/FloatingAIButton.tsx
export function FloatingAIButton() {
  const [minimized, setMinimized] = useState(false);
  const { pendingActions } = useAIActions();
  
  return (
    <div className="fixed bottom-6 right-6 z-50">
      {minimized ? (
        <Button
          size="icon"
          className="rounded-full h-14 w-14 shadow-lg"
          onClick={() => setMinimized(false)}
        >
          <Bot className="h-6 w-6" />
          {pendingActions > 0 && (
            <Badge className="absolute -top-1 -right-1">
              {pendingActions}
            </Badge>
          )}
        </Button>
      ) : (
        <AIAssistantPanel onMinimize={() => setMinimized(true)} />
      )}
    </div>
  );
}
```

---

## Security & Validation Considerations

### ⚠️ Critical Security Requirements

1. **Authorization Checks**
   - ✅ Already implemented: `verifyProjectAccess`
   - ⚠️ Need to add: Resource-level permissions
   - ⚠️ Need to add: Role-based action restrictions

2. **Input Validation**
   - ✅ Zod schemas exist
   - ⚠️ Need to add: Business rule validation (e.g., can't delete task with dependencies)
   - ⚠️ Need to add: Data integrity checks

3. **Rate Limiting**
   - ⚠️ Need to add: Per-user AI action limits
   - ⚠️ Need to add: Cost tracking (token usage)

4. **Audit Trail**
   - ⚠️ Need to add: All AI actions logged
   - ⚠️ Need to add: User can see "AI-initiated" vs "manual" changes
   - ⚠️ Need to add: Rollback capability (if user rejects after execution)

---

## User Experience Flow Examples

### Example 1: Creating a Task with Preview

**User:** "Create a task called 'Site Survey' assigned to John, due next Friday"

**AI Response:**
```
I'll create a task "Site Survey" assigned to John Smith, due Friday, January 10, 2025.

**Preview:**
- Task Name: Site Survey
- Assigned To: John Smith (john.smith@company.com)
- Due Date: January 10, 2025
- Status: Not Started
- Priority: Medium

[Approve] [Modify] [Cancel]
```

**User clicks Approve:**
- Task created
- Success message shown
- Task appears in WBS

---

### Example 2: Bulk Update with Preview

**User:** "Mark all tasks in 'Foundation' phase as 50% complete"

**AI Response:**
```
I found 8 tasks in the Foundation phase. I'll update their progress to 50%.

**Tasks to Update:**
1. Foundation Excavation (currently 30%)
2. Foundation Pouring (currently 0%)
3. Foundation Curing (currently 0%)
... (5 more)

**Warning:** 3 tasks have dependencies that may be affected.

[Review Changes] [Approve All] [Cancel]
```

**User clicks Review Changes:**
- Shows detailed diff for each task
- Highlights dependencies
- User can approve individually or all at once

---

### Example 3: Context-Aware Action

**User is viewing Task #123, types in AI:**
"Update this task to 75% complete and add a note 'Concrete poured successfully'"

**AI Response:**
```
I'll update Task #123 "Foundation Pouring":
- Progress: 30% → 75%
- Add note: "Concrete poured successfully"

[Approve] [Modify] [Cancel]
```

**Note:** AI automatically knows "this task" = Task #123 because user is viewing it.

---

## Competitive Analysis

### How Competitors Handle AI Actions

1. **Linear** (Project Management)
   - ✅ Command palette (Cmd+K)
   - ✅ AI can create/update issues
   - ⚠️ No preview system (executes immediately)
   - ✅ Context-aware

2. **GitHub Copilot**
   - ✅ Preview before applying
   - ✅ Can accept/reject suggestions
   - ✅ Shows diff view

3. **Notion AI**
   - ✅ Can edit content
   - ⚠️ No preview (but can undo)
   - ✅ Context-aware

**Our Competitive Advantage:**
- **Preview + Confirmation** = More trustworthy
- **Full CRUD** = More powerful
- **EPC-Specific** = Industry-focused
- **Audit Trail** = Compliance-ready

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Preview system backend
- [ ] Action preview modal UI
- [ ] Update existing CREATE functions to support preview mode
- [ ] Audit trail logging

### Phase 2: Extended CRUD (Week 3-4)
- [ ] Add UPDATE functions (tasks, risks, issues, resources)
- [ ] Add DELETE functions
- [ ] Add BULK operations
- [ ] Enhanced function definitions

### Phase 3: Global Access (Week 5)
- [ ] Command palette (Cmd/Ctrl+K)
- [ ] Floating AI button
- [ ] Context awareness system
- [ ] Quick actions menu

### Phase 4: Polish & Testing (Week 6)
- [ ] Security hardening
- [ ] Performance optimization
- [ ] User testing
- [ ] Documentation

---

## Risk Assessment

### High Risk Areas

1. **Security:** AI executing unauthorized actions
   - **Mitigation:** Strict authorization checks, preview system, audit trail

2. **Data Integrity:** AI making invalid changes
   - **Mitigation:** Business rule validation, preview system, rollback capability

3. **User Trust:** AI making mistakes
   - **Mitigation:** Preview system, clear descriptions, easy rejection

4. **Performance:** Too many function calls
   - **Mitigation:** Rate limiting, caching, batch operations

---

## Success Metrics

1. **Adoption Rate:** % of users using AI Assistant weekly
2. **Action Success Rate:** % of AI actions approved vs rejected
3. **Time Saved:** Average time saved per AI action vs manual
4. **Error Rate:** % of AI actions that need correction
5. **User Satisfaction:** Survey scores for AI Assistant

---

## Open Questions

1. **Should preview be mandatory or optional?**
   - **Recommendation:** Optional for low-risk actions (viewing data), mandatory for high-risk (delete, bulk updates)

2. **How to handle AI mistakes?**
   - **Recommendation:** Easy undo, clear error messages, learning from rejections

3. **Should AI learn from user corrections?**
   - **Recommendation:** Yes, but store corrections as feedback, not automatic learning (privacy concerns)

4. **Cost Management:**
   - **Recommendation:** Track token usage, show cost per action, set limits per user/org

---

## Next Steps

1. **Review this proposal** with stakeholders
2. **Prioritize features** based on user needs
3. **Start with Phase 1** (Preview system)
4. **Iterate based on feedback**

---

**Prepared by:** Senior Developer  
**Date:** 2025-01-12  
**Status:** Proposal - Awaiting Approval

