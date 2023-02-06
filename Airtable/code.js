const { base, apikey, tableName } = self.setup;


const timeout = 10000;

const baseURL = `https://api.airtable.com/v0/${base}/${tableName}`;


// Set authentication and accept type http header
const headers = {
  "Authorization": `Bearer ${apikey}`,
  "Content-Type": "application/json",
  "Accept": "application/json"
}


const findTicketId = async () => {
  const ticketId = await self.issue.get("airtable_id");
  if (ticketId == null) {
    system.printf(`not found ticketId,issueId:${self.issue.id}`);
    return -1;
  }
  return ticketId;
};

const parseAirTableFields = (issue) => {
  return {
    "title": issue.title,
    "orderId": issue.orderId,
    "description": issue.description,
    "descriptionText": issue.descriptionText,
    "type": issue.type,
    "status": issue.status,
    "priority": issue.priority,
    "reporterId": issue.reporterId,
    "projectId": issue.projectId,
    "organizationId": issue.organizationId,
    "latitude": issue.latitude,
    "longitude": issue.longitude,
    "dueDate": issue.dueDate,
  };
}



const createIssue = async () => {

  const data = {
    "records": [
      {
        "fields": parseAirTableFields(self.issue)
      }
    ]
  };
  const { err, res } = await http.send("post", baseURL,
    {
      headers, data, timeout
    });
  if (err) {
    system.printf("createIssue Error", err);
    return;
  }

  if (!(res.status == 200 && res.data.records.length > 0))
    system.printf("Issue Creation Failure", res);
  else {
    const ticketId = res.data.records[0].id;
    system.printf(`Issue Created TicketId:${ticketId}`);
    await self.issue.set("airtable_id", ticketId);
  }
};

const updateIssue = async () => {
  const ticketId = await findTicketId();

  if (ticketId == -1) return;
  system.printf(ticketId);
  const data = {
    "records": [
      {
        "id": ticketId,
        "fields": parseAirTableFields(self.issue)
      }
    ]
  };
  const { err, res } = await http.send("patch", baseURL,
    {
      headers, data, timeout
    });
  if (err) {
    system.printf("updateIssue Error", err);
    return;
  }

  if (!(res.status == 200 && res.data.records.length > 0))
    system.printf("Issue Update Failure", res);
  else {
    const ticketId = res.data.records[0].id;
    system.printf(`Issue Update TicketId:${ticketId}`);
  }
};

const deleteIssue = async () => {
  const ticketId = await findTicketId();

  if (ticketId == -1) return;


  const { err, res } = await http.send("delete", `${baseURL}?records[]=${ticketId}`,
    {
      headers, timeout
    });
  if (err) {
    system.printf("deleteIssue Error", err);
    return;
  }

  if (!(res.status == 200 && res.data.records.length > 0))
    system.printf("Issue Delete Failure", res);
  else {
    const ticketId = res.data.records[0].id;
    system.printf(`Issue Delete TicketId:${ticketId}`);
    await self.issue.del("airtable_id");
  }

};

// ======================================================================


// Entry function
const main = async () => {
  switch (self.action) {
    case IssueAction.create:
      await createIssue();
      break;
    case IssueAction.update:
      await updateIssue();
      break;
    case IssueAction.softDelete:
      break;
    case IssueAction.hardDelete:
      await deleteIssue();
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