// Canonical room IDs, linked to their source Forum; never infer from a title.
export const FORUM_RELAY_ROOMS = [
  {
    "number": 1,
    "sourceId": "fc9f3085-dabf-4e2d-b01b-7ccaf1b984da",
    "capacity": 156,
    "venue": "Domus Letitiae",
    "address": "Viale Giovanni XXIII 2, Assisi",
    "parking": "ample",
    "id": "dbcee5e7-c080-42b5-a2d3-d54f485b5706",
    "sectionId": "3e30d388-2fdc-401d-a8e0-40a582b70a9a",
    "locationId": "04cec46a-0d84-4927-8403-109d061a8afd"
  },
  {
    "number": 3,
    "sourceId": "2eb7bdd0-72b3-4c94-9db2-064be7d37caa",
    "capacity": 110,
    "venue": "Serafico",
    "address": "Viale Guglielmo Marconi 6, Assisi",
    "parking": "limited",
    "id": "ef811c92-8ab6-478f-bd1d-296046ac5eb8",
    "sectionId": "27a129ca-8ae0-41fa-afdf-0ce2d579373e",
    "locationId": "41c0d31c-68cc-44f3-b271-26e3245ab40c"
  },
  {
    "number": 9,
    "sourceId": "e8d77bc5-1559-4fc9-bea8-1e8d84f8ab0f",
    "capacity": 156,
    "venue": "Domus Letitiae",
    "address": "Viale Giovanni XXIII 2, Assisi",
    "parking": "ample",
    "id": "35b59eba-f64d-4773-aa3c-75293f9eede7",
    "sectionId": "e5b97b29-5181-42a2-bbca-dc1660c04dd1",
    "locationId": "04cec46a-0d84-4927-8403-109d061a8afd"
  },
  {
    "number": 10,
    "sourceId": "db14374f-3297-4aab-b325-4b4a5506a8dc",
    "capacity": 110,
    "venue": "Serafico",
    "address": "Viale Guglielmo Marconi 6, Assisi",
    "parking": "limited",
    "id": "b3489a23-9b47-4ed9-b49d-39ea22ce8c14",
    "sectionId": "6fc9ba35-ebf0-4fca-8dec-69b98ac51b7e",
    "locationId": "41c0d31c-68cc-44f3-b271-26e3245ab40c"
  },
  {
    "number": 18,
    "sourceId": "20aa5c45-1e8c-4f8d-a757-cb1b0624e959",
    "capacity": 110,
    "venue": "Serafico",
    "address": "Viale Guglielmo Marconi 6, Assisi",
    "parking": "limited",
    "id": "dd35fb5c-5083-49b5-af59-3016c4e34a81",
    "sectionId": "f72cb1f4-4e76-45f4-bdb3-5a5289678a67",
    "locationId": "41c0d31c-68cc-44f3-b271-26e3245ab40c"
  },
  {
    "number": 19,
    "sourceId": "fbfd9fbe-aebc-4438-8b88-a4e379e00e3c",
    "capacity": 156,
    "venue": "Domus Letitiae",
    "address": "Viale Giovanni XXIII 2, Assisi",
    "parking": "ample",
    "id": "4b8db0c8-65d9-4f26-a2d6-6c29c72fc8b9",
    "sectionId": "c3f371f8-e6e7-42a7-9b82-a9323e8df44e",
    "locationId": "04cec46a-0d84-4927-8403-109d061a8afd"
  }
] as const;
export function getForumRelayRoom(panelId: string) {
  return FORUM_RELAY_ROOMS.find(room => room.id === panelId);
}
