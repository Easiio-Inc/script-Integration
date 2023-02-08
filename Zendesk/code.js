const { host, subdomain, timeout, username, password } = self.setup;

const baseURL = `https://${subdomain}.${host}.com`;
const authBase64 = await untils.encodeConver(`${username}:${password}`, "ascii", "base64");




// 设置身份和JSON协议头
const headers = {
  "Authorization": `Basic ${authBase64}`,
  "Content-Type": "application/json",
  "Accept": "application/json"
}


const findTicketId = async () => {
  const ticketId = await self.issue.get("zendesk_id");
  if (ticketId == null) {
    system.printf(`not found ticketId,issueId:${self.issue.id}`);
    return -1;
  }
  return ticketId;
};


// 转换优先级
const getZenDeskPriorityByEasiioIssue = () => {
  switch (self.issue.priority) {
    case '5':
      return "urgent";
    case '4':
      return "high";
    case '3':
      return "normal";
    case '2':
      return "low";
    case '1':
      return "low";
    default:
      return "normal";
  }
};


// 同步创建zendesk issue
const createIssue = async () => {
  const url = `${baseURL}/api/v2/tickets`;
  const data = {
    "ticket": {
      "priority": getZenDeskPriorityByEasiioIssue(),
      "subject": self.issue.title,
      "tags": [
        "sflow.io"
      ],
      "requester": {
        "name": self.issue.reporter.name,
        "email": self.issue.reporter.email
      },
      "comment": {
        "body": self.issue.descriptionText,
        "html_body": self.issue.description
      }
    }
  };
  const { err, res } = await http.send("post", url,
    {
      headers, data, timeout
    });
  if (err) {
    system.printf("createIssue Error", err);
    return;
  }

  if (res.status != 201)
    system.printf("Issue Creation Failure", res);
  else {
    system.printf(`Issue Created TicketId:${res.data.ticket.id}`);
    await self.issue.set("zendesk_id", res.data.ticket.id);
    await self.issue.set("zendesk_requester_id", res.data.ticket.requester_id);
  }
};


// 更新zendesk issue
// 参数:ticketId
const updateIssue = async () => {
  const ticketId = await findTicketId();

  if (ticketId == -1) return;

  const requesterId = await self.issue.get("zendesk_requester_id");

  const url = `${baseURL}/api/v2/tickets/${ticketId}`;
  const data = {
    "ticket": {
      "priority": getZenDeskPriorityByEasiioIssue(),
      "subject": self.issue.title,
      "comment": {
        "author_id": requesterId,
        "body": self.issue.descriptionText,
        "html_body": self.issue.description
      },
    }
  };
  const { err, res } = await http.send("put", url, {
    headers, data, timeout
  });
  if (err) {
    system.printf("updateIssue", err);
    return;
  }
  if (res.status != 200)
    system.printf("Issue Updated Failure", res);
  else
    system.printf(`Issue Updated TicketId:${res.data.ticket.id}`);
};

// 删除zendesk issue
// 参数:ticketId
const deleteIssue = async () => {
  const ticketId = await findTicketId();
  if (ticketId == -1) return;
  const url = `${baseURL}/api/v2/tickets/${ticketId}`;
  const { err, res } = await http.send("delete", url, {
    headers, timeout
  });
  if (err) {
    system.printf("deleteIssue", err);
    return;
  }

  if (res.status != 204)
    system.printf("Issue Deleted Failure", res);
  else {
    system.printf(`Issue Deleted TicketId:${ticketId}`);
    self.issue.del("zendesk_id");

  }
  return res.status == 204;
};

// ======================================================================


const main = async () => {
  switch (self.action) {
    case IssueAction.create:
      await createIssue();
      break;
    case IssueAction.update:
      await updateIssue();
      break;
    case IssueAction.hardDelete:
      await deleteIssue();
      break;
  }

};

//Filter disallowed actions.

const allowAction = [IssueAction.create, IssueAction.update, IssueAction.hardDelete];


const index = allowAction.findIndex((action) => {
  return action == self.action;
});
if (index != -1)
  await main();
else
  return false;