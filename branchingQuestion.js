H5P.BranchingQuestion = (function () {

  function BranchingQuestion(parameters) {
    var self = this;
    self.firstFocusable;
    self.lastFocusable;
    H5P.EventDispatcher.call(self);
    this.container = null;
    let answered;
    let minutes = parameters.behaviour.minutes * 60 || 0;
    let seconds = parameters.behaviour.seconds || 0;
    this.isTimerNeeded = parameters.addTimer || false;
    this.initialTime = minutes + seconds;
    this.timeRemaining = this.initialTime;
    this.started = false;
    this.timerInterval = null;

    /**
     * Get closest ancestor of DOM element that matches selector.
     *
     * Mimics Element.closest(), workaround for IE11.
     *
     * @param {Element} element DOM element.
     * @param {string} selector CSS selector.
     * @return {Element|null} Element, if found. Else null.
     */
    const getClosestParent = function (element, selector) {
      if (!document.documentElement.contains(element)) {
        return null;
      }
      if (!Element.prototype.matches) {
        Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
      }

      do {
        if (element.matches(selector)) {
          return element;
        }
        element = element.parentElement || element.parentNode;
      }
      while (element !== null && element.nodeType === 1);
      return null;
    };

    var createWrapper = function (isTimerNeeded) {
      var wrapper = document.createElement('div');
      wrapper.classList.add('h5p-branching-question');

      const header = document.createElement('header');

      var icon = document.createElement('img');
      icon.classList.add('h5p-branching-question-icon');
      icon.src = self.getLibraryFilePath('branching-question-icon.svg');

      const timer = appendTimer();
      header.appendChild(timer);
      header.appendChild(icon);
      if (isTimerNeeded) {
        wrapper.appendChild(header);
      } else {
        wrapper.appendChild(icon);
      }

      return wrapper;
    };

    var appendTimer = () => {
      var timerWrapper = document.createElement('div');
      timerWrapper.classList.add('h5p-timer-wrapper');

      var canvas = document.createElement('canvas');
      canvas.classList.add('h5p-timer-canvas');
      canvas.width = 260;
      canvas.height = 200;
      canvas.style.width = "130px";
      canvas.style.height = "100px";
      updateCanvas(canvas, this.timeRemaining, this.initialTime);

      timerWrapper.append(canvas);

      return timerWrapper;
    }

    var appendMultiChoiceSection = function (parameters, wrapper) {
      var questionWrapper = document.createElement('div');
      questionWrapper.classList.add('h5p-multichoice-wrapper');

      var title = document.createElement('div');
      title.classList.add('h5p-branching-question-title');
      title.innerHTML = parameters.branchingQuestion.question;

      questionWrapper.appendChild(title);

      const alternatives = parameters.branchingQuestion.alternatives || [] ;
      alternatives.forEach(function (altParams, index, array) {
        const alternative = createAlternativeContainer(altParams.text);

        if (index === 0) {
          self.firstFocusable = alternative;
        }

        if (index === array.length - 1) {
          self.lastFocusable = alternative;
        }

        alternative.nextContentId = altParams.nextContentId;

        // Create feedback screen if it exists
        const hasFeedback = altParams.feedback && !!(
          altParams.feedback.title && altParams.feedback.title.trim() ||
          altParams.feedback.subtitle && altParams.feedback.subtitle.trim() ||
          altParams.feedback.image
        );
        if (hasFeedback && altParams.nextContentId !== -1) {
          alternative.feedbackScreen = createFeedbackScreen(
            altParams.feedback,
            alternative.nextContentId,
            index
          );
          alternative.proceedButton = alternative.feedbackScreen.querySelectorAll('button')[0];
        }
        alternative.hasFeedback = altParams.feedback && !!(hasFeedback || altParams.feedback.endScreenScore !== undefined);
        alternative.feedback = altParams.feedback;

        alternative.addEventListener('keyup', function (event) {
          if (event.which === 13 || event.which === 32) {
            this.click();
          }
        });

        alternative.onclick = function (e) {
          if (this.feedbackScreen !== undefined) {
            if (self.container) {
              self.container.classList.add('h5p-branching-scenario-feedback-dialog');
            }
            wrapper.innerHTML = '';
            wrapper.appendChild(this.feedbackScreen);
            answered = index;
            this.proceedButton.focus();
            self.triggerXAPI('interacted');
          }
          else {

            var currentAlt = e.target.classList.contains('.h5p-branching-question-alternative') ?
              e.target : getClosestParent(e.target, '.h5p-branching-question-alternative');
            var alts = questionWrapper.querySelectorAll('.h5p-branching-question-alternative');
            var index2;
            for (var i = 0; i < alts.length; i++) {
              if (alts[i] === currentAlt) {
                index2 = i;
                break;
              }
            }
            answered = index2;

            var nextScreen = {
              nextContentId: this.nextContentId,
              chosenAlternative: index2,
            };

            const currentAltParams = parameters.branchingQuestion.alternatives[index2];
            const currentAltHasFeedback = !!(currentAltParams.feedback.title
              || currentAltParams.feedback.subtitle
              || currentAltParams.feedback.image
              || currentAltParams.feedback.endScreenScore !== undefined
            );

            if (index2 >= 0 && currentAltHasFeedback) {
              nextScreen.feedback = currentAltParams.feedback;
            }
            self.trigger('navigated', nextScreen);
          }
        };
        questionWrapper.appendChild(alternative);
      });

      // Add alternative to go back
      const currentId = self.parent.getUserPath().slice(-1)[0] || -1;
      if (currentId >= 0 && self.parent.canEnableBackButton(currentId) === true && self.parent.getUserPath().length > 1) {
        const alternativeBack = self.createAlternativeBackContainer(self.parent.params.l10n.backButtonText);
        questionWrapper.appendChild(alternativeBack);
      }

      wrapper.appendChild(questionWrapper);
      return wrapper;
    };

    var createAlternativeContainer = function (text) {
      var wrapper = document.createElement('div');
      wrapper.classList.add('h5p-branching-question-alternative');
      wrapper.tabIndex = 0;

      var alternativeText = document.createElement('p');
      alternativeText.innerHTML = text;

      wrapper.appendChild(alternativeText);
      return wrapper;
    };

    var createFeedbackScreen = function (feedback, nextContentId, chosenAlternativeIndex) {

      var wrapper = document.createElement('div');
      wrapper.classList.add('h5p-branching-question');
      wrapper.classList.add(feedback.image !== undefined ? 'h5p-feedback-has-image' : 'h5p-feedback-default');

      if (feedback.image !== undefined && feedback.image.path !== undefined) {
        var imageContainer = document.createElement('div');
        imageContainer.classList.add('h5p-branching-question');
        imageContainer.classList.add('h5p-feedback-image');
        var image = document.createElement('img');
        image.src = H5P.getPath(feedback.image.path, self.contentId);
        imageContainer.appendChild(image);
        wrapper.appendChild(imageContainer);
      }

      var feedbackContent = document.createElement('div');
      feedbackContent.classList.add('h5p-branching-question');
      feedbackContent.classList.add('h5p-feedback-content');

      var feedbackText = document.createElement('div');
      feedbackText.classList.add('h5p-feedback-content-content');
      feedbackContent.appendChild(feedbackText);

      var title = document.createElement('h1');
      title.innerHTML = feedback.title || '';
      feedbackText.appendChild(title);

      if (feedback.subtitle) {
        var subtitle = document.createElement('div');
        subtitle.innerHTML = feedback.subtitle || '';
        feedbackText.appendChild(subtitle);
      }

      var navButton = document.createElement('button');
      navButton.onclick = function () {
        self.trigger('navigated', {
          nextContentId: nextContentId,
          chosenAlternative: chosenAlternativeIndex
        });
      };

      var text = document.createTextNode(parameters.proceedButtonText);
      navButton.appendChild(text);

      feedbackContent.appendChild(navButton);

      var KEYCODE_TAB = 9;
      feedbackContent.addEventListener('keydown', function (e) {
        var isTabPressed = (e.key === 'Tab' || e.keyCode === KEYCODE_TAB);
        if (isTabPressed) {
          e.preventDefault();
          return;
        }
      });

      wrapper.appendChild(feedbackContent);

      return wrapper;
    };

    //https://hiddedevries.nl/en/blog/2017-01-29-using-javascript-to-trap-focus-in-an-element
    var trapFocus = function (element) {
      var KEYCODE_TAB = 9;
      element.addEventListener('keydown', function (e) {
        var isTabPressed = (e.key === 'Tab' || e.keyCode === KEYCODE_TAB);

        if (!isTabPressed) {
          return;
        }

        if (e.shiftKey && document.activeElement === self.firstFocusable) /* shift + tab */ {
          self.lastFocusable.focus();
          e.preventDefault();
        }
        else if (document.activeElement === self.lastFocusable) { /* tab */
          self.firstFocusable.focus();
          e.preventDefault();
        }
      });
    };

    /**
     * Create alternative container for going back.
     * @param {string} text Text for the container.
     * @param {HTMLElement} Alternative container.
     */
    self.createAlternativeBackContainer = function (text) {
      const self = this;

      const alternativeBack = createAlternativeContainer(text);
      alternativeBack.classList.add('h5p-branching-question-alternative-back');

      alternativeBack.addEventListener('click', function () {
        self.trigger('navigated', {
          reverse: true
        });
      });

      return alternativeBack;
    };

    /**
     * Get xAPI data.
     * Contract used by report rendering engine.
     *
     * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
     */
    self.getXAPIData = function () {
      var xAPIEvent = this.createXAPIEventTemplate('answered');
      addQuestionToXAPI(xAPIEvent);
      xAPIEvent.setScoredResult(undefined, undefined, self, true);
      xAPIEvent.data.statement.result.response = answered;
      return {
        statement: xAPIEvent.data.statement
      };
    };

    /**
     * Add the question to the given xAPIEvent
     *
     * @param {H5P.XAPIEvent} xAPIEvent
     */
    var addQuestionToXAPI = function (xAPIEvent) {
      const converter = document.createElement('div');

      var definition = xAPIEvent.getVerifiedStatementValue(['object', 'definition']);
      converter.innerHTML = parameters.branchingQuestion.question;
      definition.description = {
        'en-US': converter.innerText
      };
      definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';
      definition.interactionType = 'choice';
      definition.correctResponsesPattern = [];
      definition.choices = [];
      definition.extensions = {
        'https://h5p.org/x-api/no-correct-answer': 1
      };

      const alternatives = parameters.branchingQuestion.alternatives;
      for (let i = 0; i < alternatives.length; i++) {
        converter.innerHTML = alternatives[i].text;
        definition.choices[i] = {
          'id': i + '',
          'description': {
            'en-US': converter.innerText
          }
        };
      }
    };

    /**
     * TODO
     */
    const updateCanvas = function(canvas, initialTime, timeRemaining) {
      const totalLength = (2 * Math.PI) * 0.75;
      const percentComplete = 1 - timeRemaining / initialTime;
      const context = canvas.getContext('2d');
      const middleX = canvas.width / 4;
      const middleY = canvas.height / 3.25;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.save();
      context.scale(2,2);
      // draw background
      context.beginPath()
      context.arc(middleX, middleY, 60, 0, 2 * Math.PI);
      context.fillStyle = "white";
      context.fill();
      context.fillStyle = 'black';
      context.font = "15px H5PFontAwesome4";
      context.textAlign = "center";
      if (timeRemaining > 60) {
        let minutes = Math.floor(timeRemaining / 60);
        let seconds = timeRemaining - minutes * 60;
        if (Math.ceil(seconds) < 10) context.fillText(`${minutes}:0${Math.ceil(seconds)}s`, middleX, middleY)
        else context.fillText(`${minutes}:${Math.ceil(seconds)}s`, middleX, middleY);
      } else {
        context.fillText(`${Math.ceil(timeRemaining)}s`, middleX, middleY);
      }
      context.translate(middleX, middleY);
      context.rotate(Math.PI * 0.75);
      context.translate(-middleX, -middleY);
      context.strokeStyle = "green"
      if (Math.ceil(timeRemaining) < 10) {
        context.strokeStyle = "red";
      };
      context.beginPath();
      context.arc(middleX, middleY, 45, totalLength * percentComplete, totalLength);
      context.lineWidth = 10;
      context.stroke();
      context.strokeStyle = "gray";
      context.beginPath();
      context.arc(middleX, middleY, 45, 0, totalLength * percentComplete);
      context.stroke();
      context.restore();
    }

    self.on("domChanged", (e) => {
      if (e.data.$target[0].className === "h5p-branching-question-wrapper" && !this.started) {
        const nextContentId = this.parent.currentId - 1;
        if (this.isTimerNeeded) {
          this.started = true;
          this.timerInterval = setInterval(() => {
            const canvas = document.querySelector('canvas');
            if (!canvas) clearInterval(this.timerInterval);

              updateCanvas(canvas, this.initialTime, parseFloat(this.timeRemaining.toFixed(1)));

            if (parseFloat(this.timeRemaining.toFixed(1)) < 0) {
              clearInterval(this.timerInterval);

              var nextScreen = {
                nextContentId,
              };

              self.trigger('navigated', nextScreen);
            };
            this.timeRemaining -= .1;
          }, 100);
        }
      }
    });

    // self.on('navigated', () => clearInterval(this.timerInterval));

    self.attach = function ($container) {
      // Disable back button of underlying library screen
      self.parent.disableBackButton();

      var questionContainer = document.createElement('div');
      questionContainer.classList.add('h5p-branching-question-container');

      var branchingQuestion = createWrapper(this.isTimerNeeded);
      branchingQuestion = appendMultiChoiceSection(parameters, branchingQuestion);
      trapFocus(branchingQuestion);

      questionContainer.appendChild(branchingQuestion);
      $container.append(questionContainer);
      this.container = $container[0];
    };
  }

  return BranchingQuestion;

})();
