const { token, timeout } = self.setup;
const baseURL = "https://api.hubapi.com";

// ======================================================================

// Set authentication and accept type http header
const headers = {
  "Authorization": `Bearer ${token}`,
  "Content-Type": "application/json"
}

const createIssue = async (issue) => {
  const data = {
    "properties": {
      "hs_pipeline_stage": 1,
      "subject": issue.title,
      "content": issue.descriptionText,
    }
  };
  const url = `${baseURL}/crm/v3/objects/tickets`;
  const { err, res } = await http.send("post", url, {
    headers, data, timeout
  })
  if (err) {
    system.printf("createIssue Error", err);
    return;
  }
  if (res.status != 201)
    system.printf("Issue Creation Failure", res.data);
  else {
    await system.printf(`Issue Created TicketId:${res.data.id}`);
    system.printf(res.data.id);
    await self.issue.set("hubspot_id", res.data.id);
  }

};


const searchTicket = async () => {
  const ticketId = await self.issue.get("hubspot_id");
  if (ticketId == null) return -1;
  return ticketId;
};

const updateIssue = async (issue) => {
  const ticketId = await searchTicket();
  if (ticketId == -1) {
    system.printf("not found ticket");
    return;
  }
  const data = {
    "properties": {
      "hs_pipeline_stage": 1,
      "subject": issue.title,
      "content": issue.descriptionText,
    }
  };
  const url = `${baseURL}/crm/v3/objects/tickets/${ticketId}`;
  const { err, res } = await http.send("patch", url, {
    headers, data, timeout
  })
  if (err) {
    system.printf("updateIssue Error", err);
    return;
  }
  if (res.status != 200)
    system.printf("updateIssue Failure", res.data);
  else
    system.printf(`updateIssue TicketId:${res.data.id}`);
};

const deleteIssue = async () => {
  const ticketId = await searchTicket();
  if (ticketId == -1) {
    system.printf("not found ticket");
    return;
  }
  const url = `${baseURL}/crm/v3/objects/tickets/${ticketId}`;
  const { err, res } = await http.send("delete", url, {
    headers, undefined, timeout
  })
  if (err) {
    system.printf("deleteIssue Error", err);
    return;
  }
  if (res.status != 204)
    system.printf("deleteIssue Failure", res);
  else {
    await self.issue.del("hubspot_id");
    system.printf(`deleteIssue Success`);
  }
};


// ======================================================================
// Entry function
const main = async () => {
  switch (self.action) {
    case IssueAction.create:
      await createIssue(self.issue);
      break;
    case IssueAction.update:
      await updateIssue(self.issue);
      break;
    case IssueAction.softDelete:
      await deleteIssue();
      break;
    case IssueAction.hardDelete:
      break;
    case IssueAction.test:
      break;
    case IssueAction.call:
      break;
    case IssueAction.column:
      break;
  }

};

// Is currently in async function
return await main();
