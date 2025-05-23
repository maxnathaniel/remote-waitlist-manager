# TableCheck SWE Fullstack Take-Home Assignment

Remote Waitlist Manager is a full-stack application designed to handle the waitlist of your restaurant. It manages seating, queueing, and notifications for your diners. **Multiple parties** should be able to join your restaurant's waitlist **concurrently**. Instead of waiting in line to write your name on a piece of paper, you can now join the waitlist virtually and get notified when your table is ready. This will increase your restaurant's efficiency and provide a better experience for your customers.

The user flow is as follows:

- A party of diners go to their favorite restaurant. It's fully booked, but the restaurant gives the option to join a virtual waitlist accessible via browser.
- When the diner opens the app they're asked to input their name and party size.
- After joining the waitlist, they can check the app to verify if it's their turn.
- When the table is ready for them, they check-in via the app and get seated.

## Technical Requirements

### Frontend

Our current tech stack uses ReactJS, TypeScript and isomorphic SSR, but you shouldn’t be limited to that. If you feel more proficient with a different stack, just go for it! Feel free to use a SPA, islands, traditional SSR, vue, angular, ember, vanilla JS, etc.

### Backend

Similarly, while our stack uses Ruby on Rails with MongoDB, you’re free to use any mainstream language/framework and storage.

Whatever database you decide to use, it should be runnable with a simple `docker compose up`.

## Business Requirements

**Restaurant Capacity**

Hardcoded to 10 seats.

**Service Time Calculation**

Hardcoded to 3 seconds per person. Example: A party of 4 takes 12 seconds to complete the service.

**Joining the waitlist**

The diner opens the app that shows a single form with these form elements:

1. Name input (text)
2. Party size input (number)
3. Submit button. When clicked, the party is added to the waitlist queue.

**Checking in and starting the service**

When the queued party is ready to begin service, the app should display a "check in" button. When clicked:

- The party is removed from the waitlist queue.
- The number of seats available should be decreased by the party size.
- The service countdown starts for that party.

Importantly, the user _must_ be able to view the state of their queued party across multiple browser sessions.

**Queue management**

When a party completes service:

- The system checks the queue for the next party.
- If the seats available are enough for the next party size, the next party’s app shows a new “Check-in” button.
- If not, wait until enough seats are available.

## Submission Guidelines

1. Create a public GitHub repository for your project.
2. Include this README in your repository, with clear instructions for setting up and running the project locally.
3. Include a brief explanation of your architecture decisions in the README or a separate document.

Please grant access to your repo for these following github users

- `daniellizik` - Daniel Lizik, Engineering Manager
- `LuginaJulia` - Julia Lugina, Senior Software Engineer

## Evaluation Criteria

Your submission will be evaluated based on:

1. Functionality: Does the application work as specified?
2. Code Quality: Is the code well-structured, readable, and maintainable? Add sufficient comments in places where you think it would help other contributors to onboard more quickly to understand your code.
3. Architecture: Are there clear separations of concerns and good design patterns used?
4. Customer Focus: Is the user experience intuitive? Would _you_ use this application if you were a diner? _Please_ play around with your app as if you were a customer prior to submission.
5. QA: Are you confident in the quality of your product? If you had to refactor or add new features, would you be able to do so without breaking the existing functionality? There is no guideline on how many tests you should write, what type of tests you should write, what level of coverage you need to achieve, etc. We leave it to you to decide how to ensure a level of quality that results in your customers trusting your product.

### Good luck!

## Build Instructions

- Open your favourite terminal
- Ensure that Docker Desktop is installed and running
- Open the remote-waitlist-manager project
- run docker-compose up --build
- Open at least 3 browsers (2 normal and 1 incognito) to simulate 3 users
- Play around and test out the app!
- run docker-compose down -v for teardown

## Architecture decisions

- React JS Frontend with Node JS (Express) Backend
- Postgresql DB
- React Testing Library
- Playwright
- Frontend communicates to backend via REST APIs and Websockets. Instead of using polling via the Frontend, I decided to use Websockets since the Client (Frontend) connects once (sends the initial request and upgrades the protocol to the WS protocol) and the backend udpates the client whenever there are new data. As compared to Polling, it's probably the cheaper option in terms of network cost. To be fair, I could also have made use of Polling, and there would be no visible performance difference to the users, since it is not a chatty app.
- On the backend, we have the controller - service - repository pattern. A pretty standard pattern to organize backend codebases. For simplicity, I did not create Domain Objects, DTOs, etc since the surface area of the API is pretty small. If I am building out a big app, I would carefully consider the various Domain objects and how they should be encapsulated.
- As much as possible, I created small and composable methods or components both in the Frontend and Backend.
- As for testing, I have added mostly unit test cases with some Integration tests. I had started on a few E2E test cases but found out that it only provided marginal value compared to the overall time spent on fixing flakiness, test execution logic and general E2E issues. Therefore, I decided to focus on other forms of testing.

## Assumptions

- I had taken the liberty to assume that "When a party completes service:" means "a party is seated" and not "a party has finished their meal". Otherwise, it meant that if the restaurant has 10 available seats, only 1 party (even if it's just a party of 1) can occupy the restaurant at any one time.
- Therefore, once a party is seated, the system will check the next party and enable them to check in if there are sufficient seats for them.
- I had also added a time out (1 minute hardcoded) so as not to block others in the queue if the party is non responsive
- A next feature would be to enable a cancel feature that allows parties to drop out from the queue

Thank you for taking the time to review my assigment!
