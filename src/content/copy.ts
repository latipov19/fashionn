/**
 * All visible text. Sections 14.1 to 14.6 of the brief are transcribed as written.
 * Everything under `checkout`, `forms`, `cart`, `order` and `admin` either comes from
 * brief section 11 or was written here in the brief's voice. All copy is draft until
 * checked against real product facts.
 */

export const brand = {
  name: "Lierne",
  wordmark: "LIERNE",
  tagline: "Cut flat. Hung in light.",
} as const;

export const copy = {
  meta: {
    title: "Lierne. Cut flat. Hung in light.",
    description: "Flat-cut clothes in natural cloth, hung in three rooms and shown in one light.",
  },

  nav: {
    skipToContent: "Skip to content",
    skipTheWalk: "Skip the walk",
    shop: "Shop",
    story: "Story",
    cart: "Cart",
  },

  home: {
    wall: {
      h1: "A house of clothes, lit by one sun.",
      lead: "Every piece is cut flat and hung in a room of its own. Walk through, or go straight to the rail.",
      primary: "Shop all 12 pieces",
      secondary: "Walk through",
      headerLink: "Skip the walk",
    },
    roomOne: {
      label: "Room I, morning",
      name: "Lintel Coat",
      line: "Heavy wool twill, 540 gsm",
      price: "$920",
      link: "View the coat",
    },
    roomTwo: {
      label: "Room II, noon",
      heading: "Three pieces on one bar",
      body: "Each one starts as straight panels. That is why they hang this way.",
      links: ["Mullion Shirt", "Clerestory Overshirt", "Frieze Tunic"],
    },
    roomThree: {
      label: "Room III, evening",
      name: "Nave Dress",
      line: "Silk satin, 210 gsm",
      price: "$640",
      links: ["View the dress", "See all 12 pieces"],
    },
    plan: {
      heading: "Three rooms, one line",
      body: "The doors of this house line up, so one line runs through all of it. Outerwear hangs in the morning room. Shirts hang at noon. Trousers, dresses and small things hang in the evening. Pick a room, or see them all.",
      links: [
        { room: "I", label: "Room I, Outerwear" },
        { room: "II", label: "Room II, Shirts" },
        { room: "III", label: "Room III, Evening" },
      ],
    },
    disclosure:
      "These pictures are renders, made in code from each garment's cut and cloth. They are not photographs. No one is wearing these clothes, so nothing here shows you how a piece fits. Use the measurements, which are listed on every piece. Colour is approximate, and noon is the closest light.",
  },

  footer: {
    newsletterHeading: "New pieces, when they arrive",
    field: "Email address",
    button: "Subscribe",
    success: "You are on the list.",
  },

  shop: {
    h1: "All pieces",
    bands: ["Room I, Outerwear, Morning", "Room II, Shirts, Noon", "Room III, Evening"],
    empty: "Nothing here in this size.",
    clearFilters: "Clear filters",
    loadError: "The rail did not load.",
    retry: "Retry",
    next: "Next",
    viewRail: "Rail",
    viewIndex: "Index",
    filters: { room: "Room", type: "Type", size: "Size", colour: "Colour", sort: "Sort" },
    sort: {
      peg: "Peg number",
      name: "Name",
      "price-asc": "Price, low to high",
      "price-desc": "Price, high to low",
    },
  },

  story: {
    h1: "The house",
    sections: [
      {
        heading: "Why flat",
        body: "Most clothes are built around a body. Ours start from the cloth. A piece is cut from straight panels, with as little shaping as it can carry, and joined by simple seams. It lies flat when it is off you. It takes its shape from whoever puts it on.",
      },
      {
        heading: "Why hung",
        body: "Flat clothes do not need a mannequin. So we do what a museum does with a textile. We hang the piece from a steel bar, against a plaster wall, and let one slit of sun move across it. A fold shows you how heavy the cloth is. A shadow shows you how far it stands from the wall.",
      },
      {
        heading: "Why three rooms",
        body: "The house has three rooms, plastered in oxide, verdigris and lampblack. The doors line up, so you can see from the first room to the last. An old word for this is enfilade, from the French for threading. We keep the clothes on that one line, and the day moves along it.",
      },
      {
        heading: "Why Lierne",
        body: "A lierne is a short rib in a stone vault. It does not rise from the floor. It runs between the other ribs and ties them together. It is a seam in stone.",
      },
      {
        heading: "What is real",
        body: "The rooms and the sun are made in code, and so are the pictures of the clothes. We say so because you are buying clothes, not pictures. As we photograph each piece, the photograph takes the render's place.",
      },
    ],
  },

  notFound: {
    h1: "This door was closed.",
    body: "The page you wanted is not in this house. It may have been moved, or it was never here.",
    link: "Back to the shop",
  },

  policies: {
    notice: "Draft only. Legal review is required before launch. The bracketed values are placeholders.",
    pages: {
      shipping: {
        title: "Shipping",
        summary:
          "We ship from [location] to [regions]. Orders leave within [2] working days. Standard delivery costs [$18] and takes [3 to 7] working days. You get a tracking link by email when your order leaves.",
      },
      returns: {
        title: "Returns",
        summary:
          "You have [30] days from delivery to return a piece that is unworn, with its tags on. We refund the original payment within [5] working days of receiving it. Return shipping is [paid by the customer]. Scarves are returned only if unopened.",
      },
      privacy: {
        title: "Privacy",
        summary:
          "We collect what we need to take and deliver your order: your name, address, email and order details. Payments are handled by our payment provider, and we never see your full card number. We do not sell your data. You can ask us to see or delete it at [contact email].",
      },
      terms: {
        title: "Terms",
        summary:
          "Prices are in US dollars. Images may be renders, and colour is approximate. Measurements on each piece are the reference for fit. If a piece sells out after you order, we refund you in full. These terms are governed by the laws of [jurisdiction].",
      },
    },
  },

  micro: {
    addToCart: "Add to cart",
    adding: "Adding",
    added: "Added",
    addFailed: "Could not add. Try again.",
    sizePrompt: "Pick a size",
    inStock: "In stock",
    onlyLeft: (count: number) => `Only ${count} left`,
    soldOut: "Sold out",
    disclosure: "Rendered study. Colour is approximate.",
    hourNote: "The same piece at three hours. Noon is closest to true colour.",
    cartEmpty: "Your cart is empty.",
    orderConfirmedH1: "Your order is in.",
    orderNext: "We will email you when it leaves. Keep this number.",
    checkoutError: "We could not take that payment. Nothing was charged. Check the details and try again.",
  },

  product: {
    cutCaption: "Illustrative cut. Measurements in the table are the reference.",
    fromSameRoom: "From the same room",
    hours: { morning: "Morning", noon: "Noon", evening: "Evening" },
  },

  cart: {
    title: "Your cart",
    subtitle: "Cloakroom",
    subtotal: "Subtotal",
    shippingNote: "Shipping and tax at checkout",
    checkout: "Checkout",
    shopAll: "Shop all pieces",
    remove: "Remove",
    retry: "Retry",
    full: "Your cart is full. Remove a piece to add another.",
    lineUnavailable: "No longer available",
    couldNotUpdate: "Could not update your cart. Try again.",
  },

  checkout: {
    h1: "Checkout",
    contact: "Contact",
    shippingAddress: "Shipping address",
    shippingMethod: "Shipping method",
    payment: "Payment",
    paymentMethodLabel: "Pay on delivery",
    paymentNote: "There is no online payment yet. You pay when the order reaches you.",
    placeOrder: "Place order",
    placingOrder: "Placing order",
    summary: "Your order",
    subtotal: "Subtotal",
    shipping: "Shipping",
    tax: "Tax",
    total: "Total",
    emptyRedirectNote: "Your cart is empty, so there is nothing to check out.",
    errorSummary: "Check these details",
    tooManyAttempts: "Too many attempts. Wait a minute and try again.",
    stockChanged: (available: number) =>
      available > 0
        ? `Only ${available} left in this size. We changed your cart.`
        : "That size has sold out. We changed your cart.",
  },

  order: {
    number: "Order number",
    items: "Items",
    deliveryAddress: "Delivery address",
    whatNext: "What happens next",
    status: {
      placed: "Placed",
      packed: "Packed",
      shipped: "Shipped",
      delivered: "Delivered",
      cancelled: "Cancelled",
    },
  },

  forms: {
    required: "Fill in this field.",
    email: "Enter an email address, like name@example.com.",
    phone: "Enter a phone number, or leave this empty.",
    tooLong: "This is too long.",
    invalidChoice: "Pick one of the options.",
    quantity: "Enter a quantity from 1 to 10.",
    labels: {
      email: "Email address",
      phone: "Phone (optional)",
      fullName: "Full name",
      line1: "Address",
      line2: "Apartment or unit (optional)",
      city: "City",
      region: "State or region",
      postalCode: "Postal code",
      country: "Country",
    },
    dismiss: "Dismiss",
  },

  newsletter: {
    tooMany: "Too many attempts. Wait a minute and try again.",
    failed: "Could not sign you up. Try again.",
  },

  admin: {
    title: "Back of House",
    login: {
      heading: "Sign in",
      email: "Email address",
      password: "Password",
      submit: "Sign in",
      signingIn: "Signing in",
      failed: "That email and password do not match.",
      tooMany: "Too many attempts. Wait 15 minutes and try again.",
      logout: "Sign out",
    },
    errors: {
      unauthorized: "Sign in to do that.",
      notFound: "That record no longer exists.",
      validation: "Check the highlighted fields.",
      slugTaken: "A piece with that slug already exists.",
      pegTaken: "A piece with that peg number already exists.",
      generic: "That did not save. Try again.",
      fileRequired: "Choose an image.",
      fileTooLarge: "This image is over 10 MB.",
      fileNotImage: "This file is not an image we can read. Use JPEG, PNG, WebP, AVIF or TIFF.",
      fileTooSmall: "This image is too small. The crop needs at least 480 by 600 pixels.",
      invalidStatus: (from: string, to: string) => `An order that is ${from} cannot become ${to}.`,
    },
    empty: { orders: "No orders yet." },
  },
} as const;

export function stockLabel(stock: number, lowStockAt = 2): string {
  if (stock <= 0) return copy.micro.soldOut;
  if (stock <= lowStockAt) return copy.micro.onlyLeft(stock);
  return copy.micro.inStock;
}
