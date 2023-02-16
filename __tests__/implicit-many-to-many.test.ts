// @ts-nocheck

import createPrismaClient from "../src";

describe("Implicit Many-to-Many", () => {
  describe("after connecting existing records", () => {
    let client;
    let doc;
    beforeEach(async () => {
      client = await createPrismaClient({
        document: [
          {
            id: "doc1",
            name: "Doc 1",
          },
          {
            id: "doc2",
            name: "Doc 2",
          },
        ],
        tag: [
          {
            id: "tag1",
            name: "Tag 1",
          },
          {
            id: "tag2",
            name: "Tag 2",
          },
          {
            id: "tag3",
            name: "Tag 3",
          },
        ],
      });
      doc = await client.document.update({
        where: { id: "doc1" },
        data: {
          tags: {
            connect: [{ id: "tag1" }, { id: "tag2" }],
          },
        },
        include: {
          tags: true,
        },
      });
    });

    test("primary object gets related models", async () => {
      expect(doc).toEqual({
        id: "doc1",
        name: "Doc 1",
        tags: [
          {
            id: "tag1",
            name: "Tag 1",
          },
          {
            id: "tag2",
            name: "Tag 2",
          },
        ],
      });
    });

    test("related models get primary after connect", async () => {
      const tags = await client.tag.findMany({
        include: {
          documents: true,
        },
      });

      expect(tags).toEqual(
        expect.arrayContaining([
          {
            id: "tag1",
            name: "Tag 1",
            documents: [
              {
                id: "doc1",
                name: "Doc 1",
              },
            ],
          },
          {
            id: "tag2",
            name: "Tag 2",
            documents: [
              {
                id: "doc1",
                name: "Doc 1",
              },
            ],
          },
        ])
      );
    });
  });
});
