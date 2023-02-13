const g_timeout = 20000;
let g_tableId = await self.storage.get("table_id");
const g_ticketId = await self.issue.get("airtable_id");
const { g_baseId, g_accessToken, g_tableName } = self.setup;


// Set authentication and accept type http header
const g_headers = {
  "Authorization": `Bearer ${g_accessToken}`,
  "Content-Type": "application/json"
};


const getPriorityText = () => {
  switch (self.issue.priority) {
    case '5':
      return "Highest";
    case '4':
      return "High";
    case '3':
      return "Medium";
    case '2':
      return "Low";
    case '1':
      return "Lowest";
    default:
      return "Medium";
  }
};
const parseAirTableFields = (issue) => {
  let data = {
    "title": issue.title,
    "description": issue.descriptionText,
    "type": issue.type,
    "status": issue.status,
    "priority": getPriorityText(),
    "dueDate": issue.dueDate,
    "taskSize": issue.taskSize,
    "userName": issue.reporter.name,
    "userEmail": issue.reporter.email
  };
  if (self.issue.attachments) {
    let size = issue.attachments.length > 5 ? 5 : issue.attachments.length;
    for (let i = 0; i < size; i++) {
      let key = `file_${i + 1}`;
      data[key] = [
        {
          "url": issue.attachments[i].url
        }
      ];
    }
  }
  return data;
}

const createTable = async () => {
  const url = `https://api.airtable.com/v0/meta/bases/${g_baseId}/tables`;
  const data = {
    "fields": [
      {
        "name": "title",
        "type": "singleLineText"
      },
      {
        "name": "type",
        "type": "singleLineText"
      },
      {
        "name": "status",
        "type": "singleLineText"
      },
      {
        "name": "priority",
        "type": "singleLineText"
      },
      {
        "name": "taskSize",
        "type": "singleLineText"
      },
      {
        "name": "dueDate",
        "type": "singleLineText"
      },
      {
        "name": "userName",
        "type": "singleLineText"
      },
      {
        "name": "userEmail",
        "type": "singleLineText"
      },
      {
        "name": "description",
        "type": "multilineText"
      },
      {
        "name": "file_1",
        "type": "multipleAttachments"
      },
      {
        "name": "file_2",
        "type": "multipleAttachments"
      },
      {
        "name": "file_3",
        "type": "multipleAttachments"
      },
      {
        "name": "file_4",
        "type": "multipleAttachments"
      },
      {
        "name": "file_5",
        "type": "multipleAttachments"
      }
    ],
    "name": g_tableName
  };


  const { err, res } = await http.send("post", url,
    {
      headers: g_headers, data, timeout: g_timeout
    });
  if (err) {
    system.printf("request Error", err);
    return false;
  }
  if (!(res.status == 200 && res.data.id != null))
    system.printf("createTable Error", res);
  else {
    g_tableId = res.data.id;
    system.printf(`Table Created ID:${g_tableId}`);
    await self.storage.set("table_id", g_tableId);
    return true;
  }

  return false;
};


const createIssue = async () => {
  const url = `https://api.airtable.com/v0/${g_baseId}/${g_tableId}`
  const data = {
    "records": [
      {
        "fields": parseAirTableFields(self.issue)
      }
    ]
  };
  const { err, res } = await http.send("post", url,
    {
      headers: g_headers, data, timeout: g_timeout
    });
  if (err) {
    system.printf("request Error", err);
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
  const url = `https://api.airtable.com/v0/${g_baseId}/${g_tableId}`
  const data = {
    "records": [
      {
        "id": g_ticketId,
        "fields": parseAirTableFields(self.issue)
      }
    ]
  };
  const { err, res } = await http.send("patch", url,
    {
      headers: g_headers, data, timeout: g_timeout
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
  const url = `https://api.airtable.com/v0/${g_baseId}/${g_tableId}`
  const { err, res } = await http.send("delete", `${url}?records[]=${g_ticketId}`,
    {
      headers: g_headers, timeout: g_timeout
    });
  if (err) {
    system.printf("Delete Issue Error", err);
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
  if (g_tableId == null) {
    if ((await createTable()) != true)
      return;
  }

  if (self.action != IssueAction.create && g_ticketId == null) {
    system.printf("Not Found TicketId");
    return;
  }

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
