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

  describe("nested", () => {
    let client;
    let folder;
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
        folder: [
          {
            id: "folder1",
            name: "Folder 1",
          },
        ],
      });
      await client.document.update({
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
      folder = await client.folder.update({
        where: { id: "folder1" },
        data: {
          documents: {
            connect: [{ id: "doc1" }],
          },
        },
        include: {
          documents: {
            include: {
              tags: true,
            },
          },
        },
      });
    });

    test("include returns all levels", () => {
      expect(folder.documents).toHaveLength(1);
      expect(folder.documents[0].tags).not.toBeUndefined();
      expect(folder.documents[0].tags).toHaveLength(2);
    });
  });
});
